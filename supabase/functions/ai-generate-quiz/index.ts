// supabase/functions/ai-generate-quiz/index.ts
// Owner-authenticated Edge Function for AI quiz generation (AI-05).
// verify_jwt = true (omitted from config.toml) — Supabase enforces the owner JWT;
// the handler additionally re-verifies via supabase.auth.getUser because the
// service_role client bypasses RLS (threat T-03-01).
//
// Core pattern: "fast ACK + background generation + poll" (AI-SPEC §4).
//   1. Authenticate the owner.
//   2. Read profiles.plan; enforce plan-aware file-size + question-count limits (D-06/D-07).
//   3. Insert an ai_jobs row in status='pending'.
//   4. EdgeRuntime.waitUntil(runGeneration(...)) — NEVER awaited.
//   5. Return { jobId } at HTTP 202 in <200 ms.
//
// This EF imports the OWNER auth pattern from create-quiz-access — it does NOT use the
// guest token helper, which is for anonymous quiz-takers only (RESEARCH Pitfall 1).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { GENERIC_500_MESSAGE, serializeError } from '../_shared/errors.ts'
import { extractDocumentText, MAX_SOURCE_CHARS } from '../_shared/extract-text.ts'
import { generateQuiz } from '../_shared/openai.ts'
import { normalizeDifficulty } from '../_shared/quiz-prompt.ts'
import type { GeneratedQuiz } from '../_shared/quiz-schema.ts'

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' }

// D-06 / D-07: plan-aware server-side limits (threats T-03-05 / T-03-06, constraint #4).
const PLAN_LIMITS = {
  free: { maxFileBytes: 1 * 1024 * 1024, maxQuestions: 10 },
  pro: { maxFileBytes: 5 * 1024 * 1024, maxQuestions: 100 },
} as const

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

interface GenerationInput {
  ownerId: string
  title: string
  source: string
  clarifyingPrompt: string
  count: number
  difficulty: string
  difficultyPrompt?: string
}

/**
 * Persist a generated quiz into the standard quizzes/questions/answer_options tables.
 * - quizzes.owner_id is set from the verified caller id, NEVER the request body (Pitfall 6).
 * - order_index is re-indexed deterministically 0..n-1 — the model's order_index is not
 *   trusted (Pitfall 5; mirrors useQuizEditorStore's forEach((x,i)=>x.order_index=i)).
 * @returns the new quizzes.id
 */
async function persistQuiz(
  supabase: SupabaseClient,
  ownerId: string,
  quiz: GeneratedQuiz,
): Promise<string> {
  const { data: quizRow, error: quizError } = await supabase
    .from('quizzes')
    .insert({
      owner_id: ownerId, // Pitfall 6: ownership from the verified caller, never the body
      title: quiz.title,
      description: quiz.description,
      time_limit_sec: quiz.time_limit_sec,
      is_published: false,
    })
    .select('id')
    .single()

  if (quizError || !quizRow) throw quizError ?? new Error('quizzes insert failed')
  const quizId = quizRow.id as string

  // WR-07: the three inserts below (questions, answer_options) are not transactional
  // with the quizzes insert above. If any later step fails, the quizzes row — and
  // any questions already inserted — would be left orphaned in the owner's /my list,
  // violating D-03 ("the quizzes row exists ONLY after a successful generation").
  // Wrap the remaining work so that, on ANY failure, the just-created quizzes row is
  // deleted before re-throwing; the FK ON DELETE CASCADE removes its questions and
  // answer_options, restoring the all-or-nothing invariant without a DB-side RPC.
  try {
    // Pitfall 5: re-index questions deterministically before insert.
    const questionRows = quiz.questions.map((q, i) => ({
      quiz_id: quizId,
      body: q.body,
      type: q.type,
      order_index: i,
      is_required: q.is_required,
    }))

    const { data: insertedQuestions, error: questionError } = await supabase
      .from('questions')
      .insert(questionRows)
      .select('id, order_index')

    if (questionError || !insertedQuestions) {
      throw questionError ?? new Error('questions insert failed')
    }

    // Map each inserted question back to its source by order_index, then re-index answers.
    const questionIdByOrder = new Map<number, string>()
    for (const row of insertedQuestions) {
      questionIdByOrder.set(row.order_index as number, row.id as string)
    }

    const answerRows = quiz.questions.flatMap((q, qi) => {
      const questionId = questionIdByOrder.get(qi)!
      return q.answers.map((a, ai) => ({
        question_id: questionId,
        body: a.body,
        is_correct: a.is_correct,
        order_index: ai, // Pitfall 5: deterministic 0..n-1 per answer array
      }))
    })

    const { error: answerError } = await supabase
      .from('answer_options')
      .insert(answerRows)
    if (answerError) throw answerError

    return quizId
  } catch (err) {
    // WR-07: roll back the orphaned quizzes row (cascade removes questions/answers).
    // Best-effort — if the cleanup delete itself fails, log it but still surface the
    // original error so runGeneration marks the job 'failed'.
    const { error: cleanupError } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId)
    if (cleanupError) {
      console.error(
        `persistQuiz: failed to clean up orphan quiz ${quizId}:`,
        serializeError(cleanupError),
      )
    }
    throw err
  }
}

/**
 * Background task — drives ai_jobs.stage for the D-10 progress UI and persists the result.
 * On any thrown error: ai_jobs.status='failed', no quizzes row is created (D-03).
 */
async function runGeneration(
  supabase: SupabaseClient,
  jobId: string,
  input: GenerationInput,
): Promise<void> {
  const startedAt = Date.now()
  try {
    await supabase
      .from('ai_jobs')
      .update({ stage: 'generating', updated_at: new Date().toISOString() })
      .eq('id', jobId)

    const result = await generateQuiz({
      sourceText: input.source,
      clarifyingPrompt: input.clarifyingPrompt,
      count: input.count,
      difficulty: input.difficulty,
      difficultyPrompt: input.difficultyPrompt,
    })

    await supabase
      .from('ai_jobs')
      .update({ stage: 'saving', updated_at: new Date().toISOString() })
      .eq('id', jobId)

    const quizId = await persistQuiz(supabase, input.ownerId, result.quiz)

    // AI-SPEC §7: record monitoring fields on the completed job.
    await supabase
      .from('ai_jobs')
      .update({
        status: 'completed',
        stage: 'done',
        quiz_id: quizId,
        attempt_count: result.attempts,
        finish_reason: result.finishReason,
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        duration_ms: Date.now() - startedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  } catch (err) {
    // D-11: both attempts failed (or persist failed). Record a generic error code so
    // the client can show "Повторить"; no quizzes row exists on this path (D-03).
    console.error(`ai_job ${jobId} failed:`, serializeError(err))
    await supabase
      .from('ai_jobs')
      .update({
        status: 'failed',
        error: 'AI_GENERATION_FAILED',
        failure_reason: serializeError(err).slice(0, 500),
        duration_ms: Date.now() - startedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolve the calling user from the Bearer token (threat T-03-01).
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const {
      title,
      sourceText,
      fileBase64,
      fileName,
      clarifyingPrompt,
      questionCount,
      difficulty,
      difficultyPrompt,
    } = await req.json()

    // ── Plan-aware server-side limits (D-06 / D-07, threats T-03-05 / T-03-06) ──
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return json({ error: 'Profile not found' }, 404)
    }

    const plan: keyof typeof PLAN_LIMITS = profile.plan === 'pro' ? 'pro' : 'free'
    const limits = PLAN_LIMITS[plan]

    const count = Number(questionCount)
    if (!Number.isInteger(count) || count < 1) {
      return json({ error: 'questionCount must be a positive integer' }, 400)
    }
    // D-07: reject an over-plan question count server-side.
    if (count > limits.maxQuestions) {
      return json(
        {
          error: `QUESTION_COUNT_EXCEEDED: plan '${plan}' allows at most ${limits.maxQuestions} questions`,
        },
        400,
      )
    }

    // ── Resolve the source text (extract a file server-side if one was uploaded) ──
    let source: string
    if (fileBase64) {
      if (!fileName) {
        return json({ error: 'fileName is required when fileBase64 is provided' }, 400)
      }
      // CR-02: reject an oversized base64 payload BEFORE atob() decodes it. The JSON
      // body the EF buffered is the base64 string (~1.37× the decoded file with
      // padding) — guarding the decoded byte length alone lets a client bypass the
      // plan cap and pin memory. The post-decode byte check stays as a backstop.
      if (typeof fileBase64 !== 'string') {
        return json({ error: 'fileBase64 must be a string' }, 400)
      }
      const maxB64 = Math.ceil(limits.maxFileBytes * 1.37)
      if (fileBase64.length > maxB64) {
        return json({ error: 'FILE_TOO_LARGE' }, 400)
      }
      try {
        // extractDocumentText enforces the D-06 plan size limit before extraction.
        const extracted = await extractDocumentText(
          fileBase64,
          fileName,
          limits.maxFileBytes,
        )
        source = extracted.text
      } catch (err) {
        const message = serializeError(err)
        // FILE_TOO_LARGE / UNSUPPORTED_FILE_TYPE / EMPTY_DOCUMENT are all
        // client-correctable → 400. IN-05: EMPTY_DOCUMENT covers a scanned or
        // empty file with no extractable text — the user can re-upload a
        // text-based document instead of seeing an opaque AI failure.
        if (
          message.startsWith('FILE_TOO_LARGE') ||
          message.startsWith('UNSUPPORTED_FILE_TYPE') ||
          message.startsWith('EMPTY_DOCUMENT')
        ) {
          return json({ error: message }, 400)
        }
        throw err
      }
    } else if (typeof sourceText === 'string' && sourceText.trim()) {
      // CR-02: pasted text bypasses extractDocumentText entirely, so it has no length
      // cap of its own. Slice it to MAX_SOURCE_CHARS — the same ceiling capText()
      // applies to extracted documents — so an owner cannot paste a multi-MB string
      // and force the EF to buffer it into the prompt.
      source =
        sourceText.length > MAX_SOURCE_CHARS
          ? sourceText.slice(0, MAX_SOURCE_CHARS)
          : sourceText
    } else {
      return json({ error: 'Either sourceText or fileBase64 is required' }, 400)
    }

    // ── AI monthly-limit gate (D-10 / D-14, threat T-05-09) ──────────────────
    // Enforced here, inside the service_role Edge Function, BEFORE the OpenAI
    // call runs. The effective plan is resolved via get_effective_plan (D-06:
    // subscriptions is the source of truth — NOT profiles.plan, which the
    // file-size gate above keeps reading only for size limits).
    const { data: effectivePlan, error: planError } = await supabase.rpc(
      'get_effective_plan',
      { p_user_id: user.id },
    )
    if (planError) {
      console.error('ai-generate-quiz: get_effective_plan failed', serializeError(planError))
      return json({ error: 'AI_LIMIT_CHECK_FAILED' }, 500)
    }
    const aiLimit = effectivePlan === 'pro' ? 30 : 10

    // Rolling 30-day window anchor (D-12). The gate MUST count against the
    // SAME window get_usage() shows the user (CR-03) — never a divergent
    // now()-30d fallback. If the anchor RPC fails, reject the request rather
    // than enforcing against a window the user cannot see.
    const { data: windowStartRpc, error: windowStartError } = await supabase.rpc(
      'get_ai_window_start',
      { p_user_id: user.id },
    )
    if (windowStartError || typeof windowStartRpc !== 'string' || !windowStartRpc) {
      console.error('ai-generate-quiz: get_ai_window_start failed', serializeError(windowStartError))
      return json({ error: 'AI_LIMIT_CHECK_FAILED' }, 500)
    }
    const windowStart = windowStartRpc

    // ── Insert the ai_jobs row FIRST — this is what the owner polls ──
    // CR-02: the usage row must be created AFTER (and linked to) the job so a
    // crash between the two cannot leave a phantom row that permanently
    // consumes quota. The job is the anchor; if the limit check below rejects,
    // both the usage row and the job are cleaned up.
    const { data: job, error: jobError } = await supabase
      .from('ai_jobs')
      .insert({ owner_id: user.id, status: 'pending', stage: 'reading' })
      .select('id')
      .single()

    if (jobError || !job) {
      throw jobError ?? new Error('ai_jobs insert failed')
    }

    // Pitfall 4: atomic insert-then-count. Insert the usage row (linked to the
    // job via job_id) so concurrent requests cannot both read an under-limit
    // count and slip past. A failure after this point cascades-deletes the row
    // when its owning job is removed, so quota cannot leak.
    const { data: usageRow, error: usageInsertError } = await supabase
      .from('ai_generations')
      .insert({ user_id: user.id, job_id: job.id })
      .select('id')
      .single()
    if (usageInsertError || !usageRow) {
      console.error('ai-generate-quiz: ai_generations insert failed', serializeError(usageInsertError))
      // Remove the orphan job so the owner does not poll a job that will never run.
      await supabase.from('ai_jobs').delete().eq('id', job.id)
      return json({ error: 'AI_LIMIT_CHECK_FAILED' }, 500)
    }

    const { count: usageCount, error: usageCountError } = await supabase
      .from('ai_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', windowStart)

    if (usageCountError || usageCount === null) {
      // Roll back the just-inserted row AND the job so a transient count
      // failure does not permanently consume one of the owner's generations.
      await supabase.from('ai_generations').delete().eq('id', usageRow.id)
      await supabase.from('ai_jobs').delete().eq('id', job.id)
      console.error('ai-generate-quiz: ai_generations count failed', serializeError(usageCountError))
      return json({ error: 'AI_LIMIT_CHECK_FAILED' }, 500)
    }

    if (usageCount > aiLimit) {
      // Over the monthly limit — delete the speculative row and the job, reject.
      // The error string MUST contain literal AI_LIMIT_EXCEEDED (Pitfall 7:
      // the frontend matches error.message.includes('AI_LIMIT_EXCEEDED')).
      await supabase.from('ai_generations').delete().eq('id', usageRow.id)
      await supabase.from('ai_jobs').delete().eq('id', job.id)
      return json({ error: 'AI_LIMIT_EXCEEDED', limit: aiLimit }, 429)
    }

    // ── Hand the slow work to a background task and RETURN IMMEDIATELY (<200 ms) ──
    // Never await this promise (AI-SPEC §4b — awaiting blocks the 202 response).
    EdgeRuntime.waitUntil(
      runGeneration(supabase, job.id, {
        ownerId: user.id,
        title: typeof title === 'string' ? title : '',
        source,
        clarifyingPrompt: typeof clarifyingPrompt === 'string' ? clarifyingPrompt : '',
        count,
        // CR-01: map the English client enum to the Russian key the prompt expects.
        difficulty: normalizeDifficulty(difficulty),
        difficultyPrompt:
          typeof difficultyPrompt === 'string' ? difficultyPrompt : undefined,
      }),
    )

    // 202 Accepted — the client now polls ai_jobs directly via owner-SELECT RLS.
    return json({ jobId: job.id }, 202)
  } catch (err) {
    // Log the real detail server-side; return a generic message (threat T-03-08).
    console.error('ai-generate-quiz error:', serializeError(err))
    return json({ error: GENERIC_500_MESSAGE }, 500)
  }
})
