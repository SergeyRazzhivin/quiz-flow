// supabase/functions/_shared/quiz-schema.ts
// Two-layer validation for AI-generated quizzes (AI-SPEC §4 / §4b):
//  1. QUIZ_JSON_SCHEMA — the OpenAI Structured Outputs strict schema. Constrains
//     *decoding* — the model physically cannot emit a malformed shape. Every object
//     has `additionalProperties: false` and a complete `required` list (Pitfall 1).
//  2. QuizSchema — the Zod schema. Re-validates *after* JSON.parse and adds the
//     SEMANTIC cross-field rules a JSON schema cannot express (correct-answer count).
// The two layers are deliberately separate; the JSON schema is hand-written (it is
// the contract) and Zod is used only for post-parse re-validation (AI-SPEC §3 note).

import { z } from 'npm:zod@3.24.1'

// ─── OpenAI strict JSON schema ────────────────────────────────────────────────
// Mirrors the SPEC.md quiz JSON exactly. strict:true requires `additionalProperties:
// false` on every object and EVERY property listed in `required` — there are no
// optional keys in strict mode, so `time_limit_sec` is typed ['integer','null'] and
// still listed in `required` (Pitfall 1).
export const QUIZ_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'time_limit_sec', 'questions'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    time_limit_sec: { type: ['integer', 'null'] },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['body', 'type', 'order_index', 'is_required', 'answers'],
        properties: {
          body: { type: 'string' },
          type: { type: 'string', enum: ['single', 'multiple'] },
          order_index: { type: 'integer' },
          is_required: { type: 'boolean' },
          answers: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['body', 'is_correct'],
              properties: {
                body: { type: 'string' },
                is_correct: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
} as const

// ─── Zod re-validation layer ──────────────────────────────────────────────────
const AnswerSchema = z.object({
  body: z.string().min(1),
  is_correct: z.boolean(),
})

const QuestionSchema = z
  .object({
    body: z.string().min(1),
    type: z.enum(['single', 'multiple']),
    order_index: z.number().int(),
    is_required: z.boolean(),
    answers: z.array(AnswerSchema).min(2).max(8),
  })
  // Semantic rule a JSON schema CANNOT express: a `single` question has exactly one
  // correct answer; a `multiple` question has at least one.
  .refine(
    (q) => {
      const correct = q.answers.filter((a) => a.is_correct).length
      return q.type === 'single' ? correct === 1 : correct >= 1
    },
    { message: 'Question has an invalid number of correct answers for its type' },
  )

export const QuizSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string(),
  time_limit_sec: z.number().int().positive().nullable(),
  questions: z.array(QuestionSchema).min(1),
})

export type GeneratedQuiz = z.infer<typeof QuizSchema>
