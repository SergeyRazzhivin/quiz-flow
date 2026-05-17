// supabase/functions/_shared/quiz-schema.test.ts
// Unit tests for QuizSchema — the Zod re-validation layer for AI-generated quizzes.
// Vitest-runnable: the `npm:zod@3.24.1` specifier in quiz-schema.ts is aliased to the
// project's `zod` dependency in vitest.config.ts (see resolve.alias).
// Analog: supabase/functions/_shared/scoring.test.ts

import { describe, it, expect } from 'vitest'
import { QuizSchema } from './quiz-schema'

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    body: 'Что такое HTTP?',
    type: 'single',
    order_index: 0,
    is_required: true,
    answers: [
      { body: 'Протокол передачи гипертекста', is_correct: true },
      { body: 'Язык программирования', is_correct: false },
      { body: 'Тип базы данных', is_correct: false },
    ],
    ...overrides,
  }
}

function makeQuiz(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Тест по сетям',
    description: 'Проверка знаний основ сетевых протоколов',
    time_limit_sec: 600,
    questions: [makeQuestion()],
    ...overrides,
  }
}

describe('QuizSchema — Zod re-validation of AI-generated quizzes', () => {
  it('accepts a well-formed quiz object', () => {
    expect(() => QuizSchema.parse(makeQuiz())).not.toThrow()
  })

  it('accepts a null time_limit_sec', () => {
    expect(() => QuizSchema.parse(makeQuiz({ time_limit_sec: null }))).not.toThrow()
  })

  it('throws when a `single` question has zero correct answers', () => {
    const q = makeQuestion({
      answers: [
        { body: 'A', is_correct: false },
        { body: 'B', is_correct: false },
        { body: 'C', is_correct: false },
      ],
    })
    expect(() => QuizSchema.parse(makeQuiz({ questions: [q] }))).toThrow()
  })

  it('throws when a `single` question has two correct answers', () => {
    const q = makeQuestion({
      answers: [
        { body: 'A', is_correct: true },
        { body: 'B', is_correct: true },
        { body: 'C', is_correct: false },
      ],
    })
    expect(() => QuizSchema.parse(makeQuiz({ questions: [q] }))).toThrow()
  })

  it('throws when a `multiple` question has zero correct answers', () => {
    const q = makeQuestion({
      type: 'multiple',
      answers: [
        { body: 'A', is_correct: false },
        { body: 'B', is_correct: false },
        { body: 'C', is_correct: false },
      ],
    })
    expect(() => QuizSchema.parse(makeQuiz({ questions: [q] }))).toThrow()
  })

  it('accepts a `multiple` question with two correct answers', () => {
    const q = makeQuestion({
      type: 'multiple',
      answers: [
        { body: 'A', is_correct: true },
        { body: 'B', is_correct: true },
        { body: 'C', is_correct: false },
      ],
    })
    expect(() => QuizSchema.parse(makeQuiz({ questions: [q] }))).not.toThrow()
  })

  it('throws when a question body is an empty string', () => {
    expect(() =>
      QuizSchema.parse(makeQuiz({ questions: [makeQuestion({ body: '' })] })),
    ).toThrow()
  })

  it('throws when an answer body is an empty string', () => {
    const q = makeQuestion({
      answers: [
        { body: '', is_correct: true },
        { body: 'B', is_correct: false },
        { body: 'C', is_correct: false },
      ],
    })
    expect(() => QuizSchema.parse(makeQuiz({ questions: [q] }))).toThrow()
  })

  // WR-05: the answer-count contract is 3–5 (Zod, JSON schema, prompt all agree).
  it('accepts a question with exactly 3 answers (WR-05 lower bound)', () => {
    const q = makeQuestion({
      answers: [
        { body: 'A', is_correct: true },
        { body: 'B', is_correct: false },
        { body: 'C', is_correct: false },
      ],
    })
    expect(() => QuizSchema.parse(makeQuiz({ questions: [q] }))).not.toThrow()
  })

  it('accepts a question with exactly 5 answers (WR-05 upper bound)', () => {
    const answers = Array.from({ length: 5 }, (_, i) => ({
      body: `Вариант ${i}`,
      is_correct: i === 0,
    }))
    expect(() =>
      QuizSchema.parse(makeQuiz({ questions: [makeQuestion({ answers })] })),
    ).not.toThrow()
  })

  it('throws when a question has fewer than 3 answers (WR-05)', () => {
    const q = makeQuestion({
      answers: [
        { body: 'A', is_correct: true },
        { body: 'B', is_correct: false },
      ],
    })
    expect(() => QuizSchema.parse(makeQuiz({ questions: [q] }))).toThrow()
  })

  it('throws when a question has more than 5 answers (WR-05)', () => {
    const answers = Array.from({ length: 6 }, (_, i) => ({
      body: `Вариант ${i}`,
      is_correct: i === 0,
    }))
    const q = makeQuestion({ answers })
    expect(() => QuizSchema.parse(makeQuiz({ questions: [q] }))).toThrow()
  })

  it('throws when the quiz has zero questions', () => {
    expect(() => QuizSchema.parse(makeQuiz({ questions: [] }))).toThrow()
  })
})
