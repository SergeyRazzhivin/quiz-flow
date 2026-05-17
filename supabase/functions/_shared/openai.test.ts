// supabase/functions/_shared/openai.test.ts
// Unit tests for generateQuiz's retry classification (IN-02).
// Vitest-runnable: the `npm:openai@4.104.0` specifier is mocked below, and
// `npm:zod@3.24.1` (pulled in via quiz-schema.ts) is aliased in vitest.config.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// openai.ts reads `Deno.env.get('OPENAI_API_KEY')` at module init. ESM imports
// are hoisted, so the Deno global must exist BEFORE `import { generateQuiz }`
// is evaluated — `vi.hoisted` runs its callback ahead of all imports.
vi.hoisted(() => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: () => '' },
  }
})

// ── Mock the OpenAI SDK ───────────────────────────────────────────────────────
// generateQuiz constructs `new OpenAI(...)` and calls
// `openai.chat.completions.create`. The mock lets each test script the
// completion (or throw) per attempt. `createMock` is created in a hoisted
// block so the (also-hoisted) vi.mock factory can capture it.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock('npm:openai@4.104.0', () => ({
  default: class {
    chat = { completions: { create: createMock } }
  },
}))

import { generateQuiz } from './openai'

// A well-formed completion for a 1-question single-answer quiz.
function okCompletion() {
  return {
    choices: [
      {
        message: {
          refusal: null,
          content: JSON.stringify({
            title: 'T',
            description: 'D',
            time_limit_sec: null,
            questions: [
              {
                body: 'Что такое HTTP?',
                type: 'single',
                order_index: 0,
                is_required: true,
                answers: [
                  { body: 'Протокол', is_correct: true, order_index: 0 },
                  { body: 'Язык', is_correct: false, order_index: 1 },
                  { body: 'База', is_correct: false, order_index: 2 },
                ],
              },
            ],
          }),
        },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  }
}

const input = {
  sourceText: 'материал',
  clarifyingPrompt: '',
  count: 1,
  difficulty: 'средний',
}

describe('generateQuiz — retry classification (IN-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT retry a model refusal — fails fast after one attempt', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { refusal: 'отказ', content: null }, finish_reason: 'stop' }],
    })
    await expect(generateQuiz(input)).rejects.toThrow(/refusal/)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry a count mismatch — fails fast after one attempt', async () => {
    // Returns a 2-question quiz when 1 was requested.
    const twoQuestions = okCompletion()
    const parsed = JSON.parse(twoQuestions.choices[0].message.content!)
    parsed.questions.push({ ...parsed.questions[0], order_index: 1 })
    twoQuestions.choices[0].message.content = JSON.stringify(parsed)
    createMock.mockResolvedValue(twoQuestions)
    await expect(generateQuiz(input)).rejects.toThrow(/count mismatch/)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('DOES retry a transient truncation, then succeeds on the second attempt', async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [{ message: { refusal: null, content: null }, finish_reason: 'length' }],
      })
      .mockResolvedValueOnce(okCompletion())
    const result = await generateQuiz(input)
    expect(createMock).toHaveBeenCalledTimes(2)
    expect(result.attempts).toBe(2)
  })

  it('does NOT retry an OpenAI 4xx (auth/quota) — terminal', async () => {
    createMock.mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }))
    await expect(generateQuiz(input)).rejects.toThrow(/quota/)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('DOES retry a transient 5xx, then fails after the second attempt', async () => {
    createMock.mockRejectedValue(Object.assign(new Error('upstream'), { status: 503 }))
    await expect(generateQuiz(input)).rejects.toThrow(/upstream/)
    expect(createMock).toHaveBeenCalledTimes(2)
  })
})
