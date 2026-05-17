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
    // newAttempt: explicit "start a brand-new attempt" signal from the store's
    // D-04 retake branch. Absent/false → detection mode (resume or report finished).
    const { guestToken, newAttempt } = await req.json()

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
    // Order questions and their answer options by order_index so the taker sees
    // the exact same order as the editor (which orders by order_index). Without an
    // explicit ORDER BY, Postgres returns rows in arbitrary order.
    // Nested ordering: referencedTable form for the questions array, dotted form
    // for answer_options_public nested within each question.
    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .select('*, questions(*, answer_options_public(*))')
      .eq('id', payload.quiz_id)
      .order('order_index', { referencedTable: 'questions', ascending: true })
      .order('order_index', { referencedTable: 'questions.answer_options_public', ascending: true })
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
          sessionState: 'active',
          answers: savedAnswers ?? [],
          quiz: quizMeta,
          questions,
        },
        { headers: corsHeaders },
      )
    }

    // D-04: Check for a finished session (finished_at IS NOT NULL) for this quiz_access_id.
    // The store's state machine needs to know if a finished session exists so it can:
    //   - single-attempt quiz: show result directly
    //   - allow_retake quiz: offer a new attempt (state machine handles the routing/clearing)
    const { data: finished } = await supabase
      .from('quiz_sessions')
      .select('id, started_at, finished_at, score')
      .eq('quiz_access_id', payload.quiz_access_id)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (finished) {
      // allow_retake is server-enforced here: a newAttempt request only creates a
      // second session when the quiz actually permits retakes.
      const allowRetake = (quizMeta.settings as { allow_retake?: boolean })?.allow_retake ?? false

      // newAttempt + allow_retake → fall through to the INSERT branch and create a
      // brand-new quiz_sessions row (a genuine fresh retake attempt).
      // Otherwise → return the finished session, exactly as before. A newAttempt
      // request against a single-attempt quiz still gets sessionState: 'finished'.
      if (!(newAttempt === true && allowRetake === true)) {
        // Return the finished session — the store's D-04 machine decides what to do next.
        // No session_answers needed here: if allow_retake → clear answers anyway; if single-attempt → show result.
        return Response.json(
          {
            sessionId: finished.id,
            started_at: finished.started_at,
            resumed: false,
            sessionState: 'finished',
            answers: [],
            quiz: quizMeta,
            questions,
          },
          { headers: corsHeaders },
        )
      }
      // else: fall through to the INSERT branch below — fresh retake attempt.
    }

    // No open or finished session — insert a new one.
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
        sessionState: 'new',
        answers: [],
        quiz: quizMeta,
        questions,
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    // Serialize real error messages (never String(err) on plain objects — yields [object Object])
    let message: string
    if (err instanceof Error) {
      message = err.message
    } else if (err && typeof err === 'object') {
      const e = err as { message?: unknown; code?: unknown }
      const base = typeof e.message === 'string' ? e.message : JSON.stringify(err)
      message = typeof e.code === 'string' ? `${e.code}: ${base}` : base
    } else {
      message = String(err)
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
