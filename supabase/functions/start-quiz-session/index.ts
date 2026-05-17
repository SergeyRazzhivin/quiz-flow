// supabase/functions/start-quiz-session/index.ts
// Creates a new quiz session or resumes an existing open session (D-04).
// Verified guestToken carries quiz_access_id — never trusts a client-supplied sessionId (T-02-14).
// D-02: session anchor starts here on explicit "Начать"; not at login.
// T-02-13 mitigation: isStarting store guard + partial unique index (migration 009) + resume branch.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyGuestToken } from '../_shared/jwt.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { guestToken } = await req.json()

    // T-02-12: verify token — 401 before any DB access on bad/expired token
    const payload = await verifyGuestToken(guestToken)
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch the quiz + questions so a resumed taker (who never re-enters credentials)
    // can repopulate store.quiz / store.questions. The verified guestToken already
    // proves authentication — quiz_id is taken from the trusted token payload.
    // Pitfall 4 / T-02-02: query answer_options_public (the anon-safe VIEW),
    // never the answer_options table — is_correct must never reach the guest.
    // Same select shape as verify-quiz-access/index.ts step 6.
    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .select('*, questions(*, answer_options_public(*))')
      .eq('id', payload.quiz_id)
      .single()

    if (quizErr || !quiz) {
      return new Response(JSON.stringify({ error: 'Тест не найден' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Split questions out of the quiz metadata — same shape verify-quiz-access returns.
    // T-02-02/T-02-03: password_hash and is_correct are never present here
    // (answer_options_public has no is_correct; quizzes has no password_hash).
    const { questions: quizQuestions, ...quizMeta } = quiz
    const questions = quizQuestions ?? []

    // D-04: Check for an existing open session (finished_at IS NULL) for this quiz_access_id.
    // The partial unique index (migration 009) is the DB-level backstop; this branch is the
    // app-level guard that returns the existing session instead of attempting a duplicate INSERT.
    const { data: existing } = await supabase
      .from('quiz_sessions')
      .select('id, started_at, finished_at')
      .eq('quiz_access_id', payload.quiz_access_id)
      .is('finished_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      // D-04: Also fetch the stored session_answers so a resumed taker keeps their answers.
      // Without this, the store's answers map is blank and D-07 would permanently block
      // "Вперёд" on already-answered required questions.
      const { data: savedAnswers } = await supabase
        .from('session_answers')
        .select('question_id, selected_option_ids')
        .eq('session_id', existing.id)

      return Response.json(
        {
          sessionId: existing.id,
          started_at: existing.started_at,
          resumed: true,
          answers: savedAnswers ?? [],
          quiz: quizMeta,
          questions,
        },
        { headers: corsHeaders },
      )
    }

    // No open session — insert a new one.
    const { data: session, error } = await supabase
      .from('quiz_sessions')
      .insert({ quiz_access_id: payload.quiz_access_id, quiz_id: payload.quiz_id })
      .select('id, started_at')
      .single()

    if (error) throw error

    return Response.json(
      {
        sessionId: session.id,
        started_at: session.started_at,
        resumed: false,
        answers: [],
        quiz: quizMeta,
        questions,
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
