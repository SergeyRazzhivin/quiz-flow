// supabase/functions/create-payment/index.ts
// Owner-authenticated Edge Function for YooKassa payment creation (PAY-03).
// verify_jwt = true (omitted from config.toml) — Supabase enforces the owner JWT;
// the handler additionally re-verifies via supabase.auth.getUser because the
// service_role client is used to resolve the trusted caller id.
//
// D-01: payment UX is a redirect to the YooKassa hosted page (confirmation_url).
// D-02: one-time payment per period — no saved payment method, no autopayment.
// D-04: YooKassa test shop shop_id/secret_key live in Edge Function secrets.
// D-16: monthly → 490.00 RUB, yearly → 4490.00 RUB.
//
// Threat T-05-08: metadata.user_id MUST be the verified user.id, never the body.
// Threat T-05-10: the YooKassa secret_key lives only in env, never echoed.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { GENERIC_500_MESSAGE, serializeError } from '../_shared/errors.ts'

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' }

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

// D-16: one-time price per period. Validated against an exact allowlist below.
const PERIOD_AMOUNTS = {
  monthly: '490.00',
  yearly: '4490.00',
} as const

type Period = keyof typeof PERIOD_AMOUNTS

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Owner auth — re-verify the Bearer token (threat T-05-08) ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // ── Validate the requested period against an exact allowlist ──
    let body: { period?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Неверный формат запроса' }, 400)
    }

    const period = body.period
    if (period !== 'monthly' && period !== 'yearly') {
      return json({ error: "period must be 'monthly' or 'yearly'" }, 400)
    }
    const validPeriod: Period = period
    const amount = PERIOD_AMOUNTS[validPeriod]

    // ── Create the YooKassa payment (D-01 redirect, D-02 one-time) ──
    const shopId = Deno.env.get('YOOKASSA_SHOP_ID')!
    const secretKey = Deno.env.get('YOOKASSA_SECRET_KEY')!
    const appUrl = Deno.env.get('APP_URL')!

    const yooResponse = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        // T-05-10: secret only ever lives server-side in this Basic Auth header.
        Authorization: 'Basic ' + btoa(`${shopId}:${secretKey}`),
        'Idempotence-Key': crypto.randomUUID(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: { value: amount, currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${appUrl}/billing`,
        },
        description: `Quiz Flow Pro — ${validPeriod === 'yearly' ? 'годовая' : 'месячная'} подписка`,
        // T-05-08: user_id is the verified caller id, NEVER the request body.
        metadata: { user_id: user.id, period: validPeriod },
      }),
    })

    if (!yooResponse.ok) {
      const errBody = await yooResponse.text()
      console.error('create-payment: YooKassa error', yooResponse.status, errBody)
      return json({ error: 'PAYMENT_CREATE_FAILED' }, 502)
    }

    const payment = await yooResponse.json()

    return json(
      {
        confirmation_url: payment.confirmation?.confirmation_url,
        payment_id: payment.id,
      },
      200,
    )
  } catch (err) {
    console.error('create-payment error:', serializeError(err))
    return json({ error: GENERIC_500_MESSAGE }, 500)
  }
})
