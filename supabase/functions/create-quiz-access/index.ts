// supabase/functions/create-quiz-access/index.ts
// Owner-authenticated Edge Function for creating quiz access links.
// verify_jwt = true (omitted from config.toml) — Supabase enforces owner JWT automatically.
// T-02-07: verifies quiz ownership before insert.
// T-02-09: password_hash never returned to client — plaintext password shown once only (D-15).
// quiz_access has no anon RLS policy (anon cannot read the table at all); this EF runs as
// service_role and hand-filters sensitive columns out of every select list.
// T-02-10: credentials generated via crypto.getRandomValues, not Math.random.

import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2'
import { corsHeaders } from '../_shared/cors.ts'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function generateSecureString(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { quizId, label, expiresAt } = await req.json()

    if (!quizId) {
      return new Response(JSON.stringify({ error: 'quizId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create service_role client for DB operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolve the calling user from the Bearer token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // T-02-07: Verify quiz ownership — EF is responsible since service_role bypasses RLS
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, owner_id')
      .eq('id', quizId)
      .single()

    if (quizError || !quiz) {
      return new Response(JSON.stringify({ error: 'Quiz not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (quiz.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // T-02-10: Cryptographically secure credential generation (D-14)
    const login = generateSecureString(8)
    const password = generateSecureString(16)

    // Hash the password — only password_hash is stored, never plaintext (T-02-09)
    const passwordHash = await bcrypt.hash(password, 10)

    // INSERT quiz_access row — token defaults to gen_random_uuid() in the DB
    // CR-03: also select the real row `id` (PK) so the client can use it as the
    // QuizAccess identifier — token and id are different columns, and using token
    // as the id breaks delete-before-reload.
    const { data: accessRow, error: insertError } = await supabase
      .from('quiz_access')
      .insert({
        quiz_id: quizId,
        login,
        password_hash: passwordHash,
        label: label ?? null,
        expires_at: expiresAt ?? null,
      })
      .select('id, token')
      .single()

    if (insertError || !accessRow) {
      throw insertError ?? new Error('Insert failed')
    }

    // D-15: Return plaintext password exactly once — it is never stored or re-returned
    return Response.json(
      { id: accessRow.id, token: accessRow.token, login, password },
      { headers: corsHeaders },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
