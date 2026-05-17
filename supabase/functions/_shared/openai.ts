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
      if (choice.message.refusal) {
        throw new Error(`refusal: ${choice.message.refusal}`)
      }
      // Pitfall 2: a `length` finish_reason is silent truncation — treat as a failure.
      if (choice.finish_reason !== 'stop') {
        throw new Error(`finish_reason: ${choice.finish_reason}`)
      }

      // Zod re-validation gate (D1 + D2): shape + semantic correct-answer-count rules.
      const quiz = QuizSchema.parse(JSON.parse(choice.message.content!))

      // D3: OpenAI strict mode cannot constrain array length — check count explicitly.
      if (quiz.questions.length !== input.count) {
        throw new Error(
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
      if (attempt === 2) throw err // both attempts failed → caller marks ai_jobs failed
      // else loop once more — a fresh sampling usually fixes a one-off bad generation
    }
  }

  // Unreachable — the loop either returns or throws on attempt 2.
  throw lastError ?? new Error('generateQuiz: unreachable')
}
