// evals/quiz-schema.eval.test.ts
// AI-SPEC §5 — the code-decidable eval gate. Replays recorded quiz generations
// (evals/dataset/*.json) against the REAL pipeline schema and asserts the three
// dimensions a JSON schema / Zod layer fully decides:
//
//   D1 — Schema & shape compliance   QuizSchema.parse() does not throw; finish_reason === 'stop'
//   D2 — Correct-answer-count        every `single` has exactly one is_correct; `multiple` >= 1
//   D3 — Question-count adherence    quiz.questions.length === the requested count
//
// This is the fast PR gate (AI-SPEC §5 "CI/CD Integration") — it replays fixtures,
// so it costs nothing and never calls OpenAI. The D4-D6 subjective dimensions are
// the Promptfoo job (evals/promptfooconfig.yaml), not this file.
//
// The suite imports `QuizSchema` from the real Edge Function module so the eval and
// the production pipeline can never drift. The `npm:zod@3.24.1` Deno specifier in
// that module is aliased to the project `zod` dep in vitest.config.ts.
//
// With zero fixtures in evals/dataset/ the suite is still green: each dimension has
// an it.todo placeholder. As reference cases land (AI-SPEC §5 — built incrementally),
// every *.json fixture is auto-discovered and asserted with no edit to this file.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { QuizSchema } from '../supabase/functions/_shared/quiz-schema'

const DATASET_DIR = join(dirname(fileURLToPath(import.meta.url)), 'dataset')

// A recorded generation case. `output` is the raw quiz JSON the model returned;
// `requestedCount` is what the owner asked for (D3); `finish_reason` is the OpenAI
// completion finish_reason (D1 — a `length` truncation is a silent failure).
interface EvalFixture {
  id: string
  requestedCount: number
  difficulty?: string
  clarifyingPrompt?: string
  source?: string
  finish_reason: string
  output: unknown
}

function loadFixtures(): EvalFixture[] {
  let files: string[]
  try {
    files = readdirSync(DATASET_DIR).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  return files.map((f) => {
    const raw = readFileSync(join(DATASET_DIR, f), 'utf-8')
    return JSON.parse(raw) as EvalFixture
  })
}

const fixtures = loadFixtures()

describe('AI-SPEC §5 — code-decidable eval gate (D1-D3)', () => {
  describe('D1 — schema & shape compliance', () => {
    if (fixtures.length === 0) {
      it.todo('replays evals/dataset/*.json through QuizSchema once fixtures exist')
    }
    for (const fx of fixtures) {
      it(`[${fx.id}] output satisfies QuizSchema and finished cleanly`, () => {
        // finish_reason !== 'stop' is a silent `length` truncation (AI-SPEC Pitfall 2).
        expect(fx.finish_reason).toBe('stop')
        expect(() => QuizSchema.parse(fx.output)).not.toThrow()
      })
    }
  })

  describe('D2 — correct-answer-count integrity', () => {
    if (fixtures.length === 0) {
      it.todo('asserts single==1 / multiple>=1 keyed answers once fixtures exist')
    }
    for (const fx of fixtures) {
      it(`[${fx.id}] every question has a valid correct-answer count`, () => {
        const quiz = QuizSchema.parse(fx.output)
        for (const [i, q] of quiz.questions.entries()) {
          const correct = q.answers.filter((a) => a.is_correct).length
          if (q.type === 'single') {
            expect(correct, `question ${i} (single)`).toBe(1)
          } else {
            expect(correct, `question ${i} (multiple)`).toBeGreaterThanOrEqual(1)
          }
        }
      })
    }
  })

  describe('D3 — question-count adherence', () => {
    if (fixtures.length === 0) {
      it.todo('asserts questions.length === requestedCount once fixtures exist')
    }
    for (const fx of fixtures) {
      it(`[${fx.id}] returns exactly the requested ${fx.requestedCount} question(s)`, () => {
        const quiz = QuizSchema.parse(fx.output)
        expect(quiz.questions.length).toBe(fx.requestedCount)
      })
    }
  })
})
