// supabase/functions/get-quiz-result/index.ts
// Returns the result of a finished quiz session to the result page.
// T-02-23: response never contains is_correct or password_hash.
// T-02-24: guestToken verified + session quiz_access_id validated before returning data.
// D-11: totals only — no per-question breakdown.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyGuestToken } from '../_shared/jwt.ts'
import { corsHeaders } from '../_shared/cors.ts'

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

    // Fetch the finished session for this quiz_access_id.
    // If sessionId is provided, fetch that specific session.
    // If omitted, fetch the most recent finished session for this quiz_access_id.
    let sessionQuery = supabase
      .from('quiz_sessions')
      .select('id, quiz_id, quiz_access_id, score, finished_at')
      .eq('quiz_access_id', payload.quiz_access_id)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1)

    if (sessionId) {
      sessionQuery = supabase
        .from('quiz_sessions')
        .select('id, quiz_id, quiz_access_id, score, finished_at')
        .eq('id', sessionId)
        .eq('quiz_access_id', payload.quiz_access_id)
        .not('finished_at', 'is', null)
        .limit(1)
    }

    const { data: sessions, error: sessionError } = await sessionQuery

    if (sessionError) throw sessionError

    const session = sessions?.[0]
    if (!session || session.score === null) {
      return new Response(JSON.stringify({ error: 'Результат не найден' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the question count for the quiz.
    const { count: totalQuestions, error: countError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', session.quiz_id)

    if (countError) throw countError

    // Get the taker label from quiz_access (D-10).
    // T-02-23: never return password_hash — select only 'label'.
    const { data: access, error: accessError } = await supabase
      .from('quiz_access')
      .select('label')
      .eq('id', payload.quiz_access_id)
      .single()

    if (accessError) throw accessError

    const total = totalQuestions ?? 0
    const percentage = total > 0 ? Math.round((session.score / total) * 100) : 0

    // T-02-23: response contains ONLY score/totalQuestions/percentage/label.
    // D-11: no per-question breakdown, no is_correct, no password_hash.
    return Response.json(
      {
        score: session.score,
        totalQuestions: total,
        percentage,
        label: access.label,
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
