// supabase/functions/get-quiz-meta/index.ts
// Public, pre-login quiz metadata for the /q/:token intro card.
// Source: [CITED: CONTEXT.md D-01 — intro + login on one screen]
//
// D-01: /q/:token must show the quiz intro (title, description, cover,
//       question count, time limit) BEFORE the guest enters credentials.
//       verify-quiz-access only returns quiz data AFTER login, so this
//       function exposes the non-sensitive subset for the idle state.
// D-19: access is independent of publication status — no is_published filter.
//
// Security:
//   Returns PUBLIC metadata ONLY — title, description, cover_url, time_limit_sec
//   and a question COUNT. It MUST NEVER return question content, answer
//   options, is_correct, or password_hash. Token is not authenticated here;
//   it is only used to resolve the quiz_access row to its quiz_id.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse and validate request body
    let body: { token?: unknown }
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Неверный формат запроса' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { token } = body
    if (typeof token !== 'string' || token.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Неверный формат запроса' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2. Create service_role client (bypasses RLS — EF hand-selects safe columns only)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 3. Look up the access record by token
    const { data: access, error: accessErr } = await supabase
      .from('quiz_access')
      .select('id, quiz_id, expires_at')
      .eq('token', token)
      .single()

    if (accessErr || !access) {
      return new Response(
        JSON.stringify({ state: 'invalid' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 4. Check expiry
    if (access.expires_at && new Date(access.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ state: 'invalid' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 5. Select PUBLIC metadata only — no questions/answers/is_correct/password_hash.
    //    D-19: no is_published filter.
    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .select('id, title, description, cover_url, time_limit_sec')
      .eq('id', access.quiz_id)
      .single()

    if (quizErr || !quiz) {
      return new Response(
        JSON.stringify({ state: 'invalid' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 6. Question count only — head:true returns no rows, just the count
    const { count, error: countErr } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', access.quiz_id)

    if (countErr) {
      return new Response(
        JSON.stringify({ error: String(countErr.message) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 7. Return non-sensitive metadata + count
    return Response.json(
      {
        state: 'ready',
        quiz: {
          title: quiz.title,
          description: quiz.description,
          cover_url: quiz.cover_url,
          time_limit_sec: quiz.time_limit_sec,
        },
        questionCount: count ?? 0,
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
