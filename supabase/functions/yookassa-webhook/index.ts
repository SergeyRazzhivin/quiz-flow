// supabase/functions/yookassa-webhook/index.ts
// Public YooKassa webhook — grants Pro on payment.succeeded (PAY-05 grant side).
// verify_jwt = false (registered in config.toml) — hit by YooKassa servers, not a
// Supabase client. Uses the service_role client; no Supabase JWT.
//
// D-03: payment confirmation uses the payment.succeeded webhook only (no polling);
//       the webhook is idempotent on yookassa_payment_id.
//
// Security:
//   T-05-06: no HMAC signature is available — authenticate the caller by an IP
//            allowlist against YooKassa's published ranges (real CIDR match).
//   T-05-07: a duplicate webhook for the same payment_id must NOT double-grant —
//            an idempotency SELECT runs before any upsert.
//
// Retry semantics: return HTTP 200 for processed/ignored/untrusted events so
// YooKassa stops retrying; return HTTP 500 only on a DB failure so it retries.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { serializeError } from '../_shared/errors.ts'

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' }

function respond(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

// ── YooKassa published source IP ranges (T-05-06) ──
// https://yookassa.ru/developers/using-api/webhooks#ip
const YOOKASSA_CIDRS: Array<{ base: string; bits: number }> = [
  { base: '185.71.76.0', bits: 27 },
  { base: '185.71.77.0', bits: 27 },
  { base: '77.75.153.0', bits: 25 },
  { base: '77.75.156.11', bits: 32 },
  { base: '77.75.156.35', bits: 32 },
  { base: '77.75.154.128', bits: 25 },
]
// IPv6 range 2a02:5180::/32 — compared on the first two 16-bit hextets parsed
// numerically, NOT by string prefix (compressed forms like 2a02:5180::1 and
// boundary-less prefixes like 2a02:51800:... break naive startsWith matching).
const YOOKASSA_IPV6_HEXTETS: [number, number] = [0x2a02, 0x5180]

/**
 * Expand a (possibly `::`-compressed) IPv6 string into its 8 hextets.
 * Returns null if the address is malformed.
 */
function ipv6ToHextets(ip: string): number[] | null {
  const zoneless = ip.split('%')[0] ?? ip
  const halves = zoneless.split('::')
  if (halves.length > 2) return null
  const parseGroup = (g: string): number[] | null => {
    if (g === '') return []
    const out: number[] = []
    for (const part of g.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null
      out.push(parseInt(part, 16))
    }
    return out
  }
  if (halves.length === 2) {
    const head = parseGroup(halves[0])
    const tail = parseGroup(halves[1])
    if (head === null || tail === null) return null
    const fill = 8 - head.length - tail.length
    if (fill < 0) return null
    return [...head, ...new Array(fill).fill(0), ...tail]
  }
  const all = parseGroup(zoneless)
  if (all === null || all.length !== 8) return null
  return all
}

/** Parse a dotted-quad IPv4 string into a 32-bit unsigned integer. Null if malformed. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    result = (result << 8) | n
  }
  return result >>> 0
}

/** Real CIDR membership test — masks both addresses to the prefix length and compares. */
function ipv4InCidr(ip: number, baseIp: number, bits: number): boolean {
  if (bits === 0) return true
  const mask = (0xffffffff << (32 - bits)) >>> 0
  return (ip & mask) === (baseIp & mask)
}

/** True if the client IP falls inside any YooKassa published range. */
function isYooKassaIp(rawIp: string): boolean {
  const ip = rawIp.trim()
  if (ip.includes(':')) {
    // IPv6 — parse to hextets and compare the first two numerically (/32).
    const hextets = ipv6ToHextets(ip)
    if (hextets === null) return false
    return (
      hextets[0] === YOOKASSA_IPV6_HEXTETS[0] &&
      hextets[1] === YOOKASSA_IPV6_HEXTETS[1]
    )
  }
  const ipInt = ipv4ToInt(ip)
  if (ipInt === null) return false
  for (const cidr of YOOKASSA_CIDRS) {
    const baseInt = ipv4ToInt(cidr.base)
    if (baseInt === null) continue
    if (ipv4InCidr(ipInt, baseInt, cidr.bits)) return true
  }
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Source IP allowlist (T-05-06) ──
    // x-forwarded-for may be a comma-separated chain — the client IP is the first.
    const forwardedFor = req.headers.get('x-forwarded-for') ?? ''
    const clientIp = forwardedFor.split(',')[0]?.trim() ?? ''
    if (!isYooKassaIp(clientIp)) {
      // Untrusted source — skip processing. Return 200 so probes do not trigger
      // YooKassa retry storms (the real YooKassa server never lands here).
      console.warn('yookassa-webhook: rejected untrusted IP', clientIp)
      return respond({ ignored: true }, 200)
    }

    // ── 2. Parse the payload (malformed JSON → 400) ──
    let payload: {
      event?: unknown
      object?: {
        id?: unknown
        status?: unknown
        paid?: unknown
        amount?: { value?: unknown; currency?: unknown }
        metadata?: { user_id?: unknown; period?: unknown }
      }
    }
    try {
      payload = await req.json()
    } catch {
      return respond({ error: 'Invalid JSON' }, 400)
    }

    // ── 3. Only act on payment.succeeded; ignore everything else ──
    if (payload.event !== 'payment.succeeded') {
      return respond({ ignored: true }, 200)
    }

    const obj = payload.object
    const paymentId = obj?.id
    const userId = obj?.metadata?.user_id
    const period = obj?.metadata?.period

    if (typeof paymentId !== 'string' || typeof userId !== 'string') {
      console.error('yookassa-webhook: missing payment id or user_id in metadata')
      return respond({ ignored: true }, 200)
    }

    // ── 3a. Validate the period label against an allowlist (WR-01, WR-07) ──
    // `period` is unvalidated external input flowing into a grant decision; an
    // absent/garbage value must NOT silently default to a 30-day grant.
    if (period !== 'monthly' && period !== 'yearly') {
      console.error('yookassa-webhook: invalid or missing period in metadata', period)
      return respond({ ignored: true }, 200)
    }

    // ── 3b. Verify payment status AND the amount actually paid (CR-01) ──
    // The integrity guarantee for a payment system is the amount, not the
    // free-text `period` label. Reject anything that is not a confirmed,
    // fully-paid RUB payment matching the expected price for the period.
    const EXPECTED_AMOUNT = { monthly: '490.00', yearly: '4490.00' } as const
    const amountValue = obj?.amount?.value
    const amountCurrency = obj?.amount?.currency
    if (obj?.status !== 'succeeded' || obj?.paid !== true) {
      console.error('yookassa-webhook: payment not in succeeded/paid state', obj?.status, obj?.paid)
      return respond({ ignored: true }, 200)
    }
    if (amountCurrency !== 'RUB' || amountValue !== EXPECTED_AMOUNT[period]) {
      console.error('yookassa-webhook: amount mismatch', period, amountValue, amountCurrency)
      return respond({ ignored: true }, 200)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 4. Idempotency: skip if this payment was already processed (T-05-07) ──
    const { data: existing, error: lookupError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('yookassa_payment_id', paymentId)
      .maybeSingle()

    if (lookupError) {
      console.error('yookassa-webhook: idempotency lookup failed', serializeError(lookupError))
      return respond({ error: 'lookup_failed' }, 500) // 500 → YooKassa retries
    }
    if (existing) {
      // Already granted for this payment — do not double-grant.
      return respond({ ok: true, idempotent: true }, 200)
    }

    // ── 4a. Read the current subscription so a renewal EXTENDS the term ──
    // (WR-02) A mid-period renewal must stack on top of the remaining days,
    // not replace them. Anchor the new period on the GREATER of now() and the
    // existing (unexpired) current_period_end.
    const { data: currentSub, error: currentSubError } = await supabase
      .from('subscriptions')
      .select('current_period_end')
      .eq('user_id', userId)
      .maybeSingle()

    if (currentSubError) {
      console.error('yookassa-webhook: current subscription lookup failed', serializeError(currentSubError))
      return respond({ error: 'lookup_failed' }, 500) // 500 → YooKassa retries
    }

    // ── 5. Grant Pro until the period end (D-02 one-time, manual renewal) ──
    const days = period === 'yearly' ? 365 : 30
    const now = Date.now()
    const existingEndMs = currentSub?.current_period_end
      ? new Date(currentSub.current_period_end).getTime()
      : 0
    const anchorMs = Number.isFinite(existingEndMs) && existingEndMs > now ? existingEndMs : now
    const periodEnd = new Date(anchorMs + days * 24 * 60 * 60 * 1000).toISOString()

    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan: 'pro',
          status: 'active',
          yookassa_payment_id: paymentId,
          current_period_end: periodEnd,
          current_period: period,
        },
        { onConflict: 'user_id' },
      )

    if (upsertError) {
      console.error('yookassa-webhook: subscription upsert failed', serializeError(upsertError))
      return respond({ error: 'upsert_failed' }, 500) // 500 → YooKassa retries
    }

    return respond({ ok: true }, 200)
  } catch (err) {
    console.error('yookassa-webhook error:', serializeError(err))
    return respond({ error: 'internal_error' }, 500) // 500 → YooKassa retries
  }
})
