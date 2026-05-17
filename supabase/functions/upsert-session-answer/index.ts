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
      .select('id, quiz_access_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionError) throw sessionError

    if (!session || session.quiz_access_id !== payload.quiz_access_id) {
      return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
        status: 403,
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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
