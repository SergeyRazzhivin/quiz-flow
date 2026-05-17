// supabase/functions/upsert-session-answer/index.ts
// Persists a single answer selection to session_answers immediately on selection (Pitfall 2).
// Uses service_role to bypass RLS — the EF must confirm session ownership (T-02-17).
// Pattern 5 from RESEARCH.md + Pattern 1 (Deno.serve skeleton).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyGuestToken } from '../_shared/jwt.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { guestToken, sessionId, questionId, selectedOptionIds } = await req.json()

    // T-02-17: Verify guestToken first — 401 before any DB access on bad/expired token.
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

    // T-02-17 defense-in-depth: confirm the session's quiz_access_id matches the token
    // payload before writing. This prevents a session-injection attack where a forged
    // sessionId is used to write answers to another taker's session.
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('id, quiz_access_id, quiz_id, finished_at')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionError) throw sessionError

    if (!session || session.quiz_access_id !== payload.quiz_access_id) {
      return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // CR-02: Reject writes to an already-finished session. The score is locked by
    // submit-quiz-answers' idempotency, but the underlying answer rows are still
    // mutable — a late upsert would corrupt the owner's Phase-4 statistics view.
    if (session.finished_at !== null) {
      return new Response(JSON.stringify({ error: 'Session already finished' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // CR-02: Validate that the question belongs to this session's quiz. The FK only
    // guarantees questionId is *some* valid question; without this check a forged
    // request could create session_answers rows referencing an unrelated quiz.
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id')
      .eq('id', questionId)
      .eq('quiz_id', session.quiz_id)
      .maybeSingle()

    if (questionError) throw questionError

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question does not belong to this quiz' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // T-02-19: Upsert on conflict (session_id, question_id) — idempotent re-selection.
    const { error: upsertError } = await supabase
      .from('session_answers')
      .upsert(
        {
          session_id: sessionId,
          question_id: questionId,
          selected_option_ids: selectedOptionIds,
        },
        { onConflict: 'session_id,question_id' },
      )

    if (upsertError) throw upsertError

    return Response.json({ ok: true }, { headers: corsHeaders })
  } catch (err) {
    // Postgrest/Supabase errors are plain objects, not Error instances —
    // String(err) would produce a useless "[object Object]". Surface the
    // real message (and code, when present) instead.
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
