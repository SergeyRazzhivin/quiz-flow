// supabase/functions/verify-quiz-access/index.ts
// Guest credential verification + guest token issuance.
// Source: [CITED: ARCHITECTURE.md Guest Auth Flow + CONTEXT.md D-01/D-19]
// See RESEARCH.md "verify-quiz-access — Full Edge Function" code block.
//
// Security:
//   T-02-01: guest token signed with GUEST_JWT_SECRET (HS256, 1h TTL)
//   T-02-02: queries answer_options_public view — is_correct never in response
//   T-02-03: password_hash selected for compare only — never in response body
//   T-02-04: identical 401 for "not found" vs "wrong password" — no enumeration oracle
//
// D-19: access is independent of publication status — no publication filter applied.
// Pitfall 6: if questions.length === 0 return { state: 'not_ready' } (HTTP 200).

import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2'
import { signGuestToken } from '../_shared/jwt.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { GENERIC_500_MESSAGE, serializeError } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse and validate request body
    let body: { token?: unknown; login?: unknown; password?: unknown }
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Неверный формат запроса' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { token, login, password } = body
    if (typeof token !== 'string' || typeof login !== 'string' || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Неверный формат запроса' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2. Create service_role client (bypasses RLS — EF must hand-filter sensitive columns)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 3. Fetch access record by token AND login
    // T-02-04: identical 401 for "not found" vs "wrong password" — no enumeration oracle
    const { data: access, error: accessErr } = await supabase
      .from('quiz_access')
      .select('id, quiz_id, password_hash, expires_at')
      .eq('token', token)
      .eq('login', login)
      .single()

    if (accessErr || !access) {
      return new Response(
        JSON.stringify({ error: 'Неверный логин или пароль' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 4. Check expiry
    if (access.expires_at && new Date(access.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Срок действия ссылки истёк' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 5. Verify password — T-02-04: same 401 message as "not found"
    const valid = await bcrypt.compare(password, access.password_hash)
    if (!valid) {
      return new Response(
        JSON.stringify({ error: 'Неверный логин или пароль' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 6. Fetch quiz with questions + answer options (NO is_correct — use the public view)
    // D-19: no publication filter — access is independent of publication state
    // Pitfall 4: query answer_options_public view, not the answer_options table directly
    // Order questions and their answer options by order_index so the taker sees
    // the exact same order as the editor (which orders by order_index). Without an
    // explicit ORDER BY, Postgres returns rows in arbitrary order.
    // Nested ordering: referencedTable form for the questions array, dotted form
    // for answer_options_public nested within each question. Kept consistent with
    // start-quiz-session/index.ts.
    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .select('*, questions(*, answer_options_public(*))')
      .eq('id', access.quiz_id)
      .order('order_index', { referencedTable: 'questions', ascending: true })
      .order('order_index', { referencedTable: 'questions.answer_options_public', ascending: true })
      .single()

    if (quizErr || !quiz) {
      return new Response(
        JSON.stringify({ error: 'Тест не найден' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 7. D-19 / Pitfall 6: graceful no-questions state
    const questions = quiz.questions ?? []
    if (questions.length === 0) {
      return Response.json(
        { state: 'not_ready' },
        { headers: corsHeaders },
      )
    }

    // 8. Issue guest token (T-02-01: signed with GUEST_JWT_SECRET, HS256, 1h TTL)
    const guestToken = await signGuestToken({
      quiz_access_id: access.id,
      quiz_id: access.quiz_id,
    })

    // 9. Return quiz metadata (without questions nested) + questions separately
    // T-02-02/T-02-03: password_hash and is_correct must never be in the response
    const { questions: _questions, ...quizMeta } = quiz

    return Response.json(
      {
        state: 'ready',
        guestToken,
        quiz: quizMeta,
        questions,
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    // WR-05: log the real detail server-side; return a generic message to the
    // unauthenticated guest so internal details (table/constraint names) never leak.
    console.error('verify-quiz-access error:', serializeError(err))
    return new Response(
      JSON.stringify({ error: GENERIC_500_MESSAGE }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
