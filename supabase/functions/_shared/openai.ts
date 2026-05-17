// supabase/functions/_shared/openai.ts
// Thin OpenAI wrapper for the AI quiz generator (AI-SPEC §4 / §4b).
//
// generateQuiz() is a single-shot Structured Outputs call with the D-11 single retry
// (max 2 attempts total). It is the project's only AI surface for Phase 3 — no tools,
// no agent loop, no streaming.
//
// HARD VERSION PIN: openai@4.104.0 — the AI-SPEC §4b code is v4-only (`response_format`,
// `message.refusal`, `finish_reason`). Do NOT upgrade to the v6 SDK major. The hand-written
// QUIZ_JSON_SCHEMA is used directly — `openai/helpers/zod` is NOT imported (AI-SPEC §3:
// the deep subpath is brittle under `npm:` cold-start resolution).

import OpenAI from 'npm:openai@4.104.0'
import { QUIZ_JSON_SCHEMA, QuizSchema, type GeneratedQuiz } from './quiz-schema.ts'
import { SYSTEM_PROMPT, buildUserPrompt } from './quiz-prompt.ts'
import { serializeError } from './errors.ts'

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })

export interface GenerateQuizInput {
  sourceText: string
  clarifyingPrompt: string
  count: number
  difficulty: string
  difficultyPrompt?: string
}

export interface GenerateQuizResult {
  quiz: GeneratedQuiz
  /** Monitoring fields recorded onto the ai_jobs row (AI-SPEC §7). */
  attempts: number
  finishReason: string
  promptTokens: number
  completionTokens: number
}

/** Scale max_tokens with the requested question count (~250-400 output tokens/question). */
function maxTokensFor(count: number): number {
  // ~8000 covers a 10-question quiz; scale linearly, cap at ~16000 for Pro 100-question.
  return Math.min(16_000, Math.max(8_000, count * 450))
}

/**
 * IN-02: a non-retryable terminal failure. The 2-attempt loop must only retry
 * TRANSIENT classes (truncation, JSON parse, network / 5xx) where a fresh
 * sampling can plausibly fix a one-off bad generation. A model `refusal` is
 * deterministic — a retry will almost certainly refuse again — and a Zod
 * `count mismatch` is usually a systematic prompt problem; retrying either just
 * burns an OpenAI call and ~10s of latency. Throwing this subclass tells the
 * loop to fail fast.
 */
export class TerminalGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TerminalGenerationError'
  }
}

/**
 * Decide whether a thrown error is worth a second attempt. Only transient
 * failures are retryable; a TerminalGenerationError (refusal / count mismatch)
 * is not. An OpenAI 4xx (auth, quota, bad request) is also terminal — a retry
 * cannot fix it. A 5xx, a network/timeout error, or a JSON parse failure is
 * transient and worth one more attempt.
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof TerminalGenerationError) return false
  // openai@4 surfaces HTTP errors with a numeric `status`. 4xx is terminal;
  // 5xx (and anything without a status — network/timeout/parse) is transient.
  const status = (err as { status?: unknown })?.status
  if (typeof status === 'number') return status >= 500
  return true
}

/**
 * Generate a quiz from source text via OpenAI Structured Outputs.
 * Runs at most 2 attempts (D-11); the second runs only if the first throws.
 * After 2 failures it re-throws — the caller marks ai_jobs.status='failed'.
 *
 * @throws on a `count mismatch` when quiz.questions.length !== input.count.
 */
export async function generateQuiz(input: GenerateQuizInput): Promise<GenerateQuizResult> {
  let lastError: unknown

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: maxTokensFor(input.count),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildUserPrompt({
              sourceText: input.sourceText,
              clarifyingPrompt: input.clarifyingPrompt,
              count: input.count,
              difficulty: input.difficulty,
              difficultyPrompt: input.difficultyPrompt,
            }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'quiz', strict: true, schema: QUIZ_JSON_SCHEMA },
        },
        stream: false,
      })

      const choice = completion.choices[0]

      // Pitfall 3: check `refusal` BEFORE JSON.parse — a refusal has null content.
      // IN-02: a refusal is deterministic — terminal, no retry.
      if (choice.message.refusal) {
        throw new TerminalGenerationError(`refusal: ${choice.message.refusal}`)
      }
      // Pitfall 2: a `length` finish_reason is silent truncation — treat as a
      // failure. IN-02: truncation is transient (a fresh sampling may fit), so
      // it is thrown as a plain Error and remains retryable.
      if (choice.finish_reason !== 'stop') {
        throw new Error(`finish_reason: ${choice.finish_reason}`)
      }

      // Zod re-validation gate (D1 + D2): shape + semantic correct-answer-count
      // rules. A JSON parse or Zod shape error is transient (plain Error → retry).
      const quiz = QuizSchema.parse(JSON.parse(choice.message.content!))

      // D3: OpenAI strict mode cannot constrain array length — check count
      // explicitly. IN-02: a count mismatch is usually a systematic prompt
      // problem — terminal, no retry.
      if (quiz.questions.length !== input.count) {
        throw new TerminalGenerationError(
          `count mismatch: got ${quiz.questions.length}, want ${input.count}`,
        )
      }

      return {
        quiz,
        attempts: attempt,
        finishReason: choice.finish_reason,
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
      }
    } catch (err) {
      lastError = err
      // AI-SPEC §7 monitoring signal: log every attempt failure with its reason.
      console.error(`generateQuiz attempt ${attempt} failed:`, serializeError(err))
      // IN-02: fail fast on a terminal (non-transient) failure — a refusal, a
      // count mismatch, or an OpenAI 4xx will not be fixed by a retry. Only a
      // transient failure (truncation / JSON parse / network / 5xx) loops once
      // more, since a fresh sampling usually fixes a one-off bad generation.
      if (attempt === 2 || !isRetryable(err)) throw err
    }
  }

  // Unreachable — the loop either returns or throws on attempt 2.
  throw lastError ?? new Error('generateQuiz: unreachable')
}
