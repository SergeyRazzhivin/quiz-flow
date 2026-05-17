// supabase/functions/submit-quiz-answers/index.ts
// Finalizes a quiz session with server-side partial-credit scoring (D-17).
// Security: the client NEVER submits a score — this EF computes it from
// session_answers + answer_options.is_correct (service_role only).
// T-02-22: score tampering mitigated by ignoring any client-supplied score value.
// T-02-24: guestToken verified + session quiz_access_id validated before any scoring.
// T-02-25: idempotent — an already-finished session returns its stored score without re-scoring.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyGuestToken } from '../_shared/jwt.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { scoreQuestion } from '../_shared/scoring.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { guestToken, sessionId } = await req.json()

    // T-02-24: Verify guestToken first — 401 before any DB access on bad/expired token.
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

    // CR-01: Enforce the access-link expiry — an expired link must not allow scoring.
    const { data: access } = await supabase
      .from('quiz_access')
      .select('expires_at')
      .eq('id', payload.quiz_access_id)
      .single()
    if (access?.expires_at && new Date(access.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Срок действия ссылки истёк' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // T-02-24 defense-in-depth: load the session and confirm quiz_access_id matches
    // the token payload before scoring. Prevents session-injection attacks.
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('id, quiz_access_id, quiz_id, finished_at, score')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionError) throw sessionError

    if (!session || session.quiz_access_id !== payload.quiz_access_id) {
      return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // T-02-25 idempotency: if the session is already finished, return the stored score
    // without re-scoring. This handles the timer-expiry + manual stop double-submit race.
    if (session.finished_at !== null && session.score !== null) {
      // We need the question count to compute the percentage.
      const { count: totalQuestions } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('quiz_id', session.quiz_id)

      const total = totalQuestions ?? 0
      const percentage = total > 0 ? Math.round((session.score / total) * 100) : 0

      return Response.json(
        { score: session.score, totalQuestions: total, percentage },
        { headers: corsHeaders },
      )
    }

    // Load session_answers for this session.
    const { data: sessionAnswers, error: answersError } = await supabase
      .from('session_answers')
      .select('question_id, selected_option_ids')
      .eq('session_id', sessionId)

    if (answersError) throw answersError

    // Load the questions for this quiz first — answer_options has no quiz_id
    // column, so options are fetched by question_id below.
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id')
      .eq('quiz_id', session.quiz_id)

    if (questionsError) throw questionsError

    const totalQuestions = questions?.length ?? 0
    const questionIds = (questions ?? []).map((q) => q.id)

    // Load the answer_options BASE TABLE (service_role — this is the only place
    // is_correct is read; Pitfall 4 / RESEARCH Open Question 3 / T-02-23).
    // answer_options links to questions via question_id (no quiz_id column).
    const { data: allOptions, error: optionsError } = await supabase
      .from('answer_options')
      .select('id, question_id, is_correct')
      .in('question_id', questionIds)

    if (optionsError) throw optionsError

    // Build a map: question_id → correct_option_ids[]
    const correctMap: Record<string, string[]> = {}
    for (const opt of allOptions ?? []) {
      if (!correctMap[opt.question_id]) correctMap[opt.question_id] = []
      if (opt.is_correct) correctMap[opt.question_id].push(opt.id)
    }

    // Build a map: question_id → selected_option_ids[]
    const selectedMap: Record<string, string[]> = {}
    for (const ans of sessionAnswers ?? []) {
      selectedMap[ans.question_id] = ans.selected_option_ids
    }

    // Score each question using the D-17 partial-credit formula.
    let totalScore = 0
    for (const question of questions ?? []) {
      const qid = question.id
      totalScore += scoreQuestion({
        correct_option_ids: correctMap[qid] ?? [],
        selected_option_ids: selectedMap[qid] ?? [],
      })
    }

    // score column is numeric (migration 009) — fractional values are stored faithfully.
    const { error: updateError } = await supabase
      .from('quiz_sessions')
      .update({ finished_at: new Date().toISOString(), score: totalScore })
      .eq('id', sessionId)

    if (updateError) throw updateError

    const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0

    // T-02-23: response contains ONLY score/totalQuestions/percentage — never is_correct.
    return Response.json(
      { score: totalScore, totalQuestions, percentage },
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
