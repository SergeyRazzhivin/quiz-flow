// supabase/functions/_probe-bcrypt/index.ts
// Temporary Wave-1 verification probe for the [ASSUMED] bcryptjs-in-Deno assumption.
// Source: RESEARCH.md Open Question 1 / Assumption A1 + Pattern 3.
//
// If the human checkpoint reports this probe fails (hashValid: false or HTTP error),
// the executor must apply the PBKDF2 fallback (crypto.subtle / jsr:@std/crypto)
// and note the deviation in the SUMMARY before building verify-quiz-access.

import { corsHeaders } from '../_shared/cors.ts'
import bcrypt from 'npm:bcryptjs@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const hash = await bcrypt.hash('probe', 10)
    const valid = await bcrypt.compare('probe', hash)

    return Response.json(
      { ok: true, hashValid: valid },
      { headers: corsHeaders },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
