// supabase/functions/_shared/quiz-prompt.test.ts
// Unit tests for the AI quiz prompt builder and the difficulty normalization (CR-01).
// Vitest-runnable: quiz-prompt.ts has no Deno-only specifiers.
// Analog: supabase/functions/_shared/quiz-schema.test.ts

import { describe, it, expect } from 'vitest'
import { buildUserPrompt, normalizeDifficulty } from './quiz-prompt'

describe('normalizeDifficulty (CR-01)', () => {
  it('maps the English client enum to the Russian prompt key', () => {
    expect(normalizeDifficulty('easy')).toBe('лёгкий')
    expect(normalizeDifficulty('medium')).toBe('средний')
    expect(normalizeDifficulty('hard')).toBe('сложный')
  })

  it('defaults to средний for an unexpected or missing value', () => {
    expect(normalizeDifficulty('extreme')).toBe('средний')
    expect(normalizeDifficulty('')).toBe('средний')
    expect(normalizeDifficulty(undefined)).toBe('средний')
    expect(normalizeDifficulty(null)).toBe('средний')
    expect(normalizeDifficulty(42)).toBe('средний')
  })
})

describe('buildUserPrompt — difficulty instruction (CR-01)', () => {
  const base = {
    sourceText: 'Исходный материал для теста.',
    clarifyingPrompt: 'фокус на ключевых фактах',
    count: 5,
  }

  it('a hard difficulty produces the Russian cognitive instruction in the prompt', () => {
    // CR-01: the client sends 'hard'; it must be normalized to 'сложный' so the
    // DIFFICULTY_INSTRUCTIONS lookup hits and the cognitive register reaches the model.
    const prompt = buildUserPrompt({
      ...base,
      difficulty: normalizeDifficulty('hard'),
    })
    expect(prompt).toContain(
      'вопросы на применение и анализ, с близкими по смыслу дистракторами',
    )
    // Regression guard: the un-normalized English enum must NOT leak into the prompt.
    expect(prompt).not.toContain('hard')
  })

  it('an easy difficulty produces the узнавание-фактов instruction', () => {
    const prompt = buildUserPrompt({
      ...base,
      difficulty: normalizeDifficulty('easy'),
    })
    expect(prompt).toContain(
      'вопросы на прямое узнавание фактов, явно указанных в материале',
    )
  })

  it('a medium difficulty produces the понимание-связей instruction', () => {
    const prompt = buildUserPrompt({
      ...base,
      difficulty: normalizeDifficulty('medium'),
    })
    expect(prompt).toContain('вопросы на понимание и связи между фактами материала')
  })
})
