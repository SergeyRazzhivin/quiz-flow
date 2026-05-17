// supabase/functions/_shared/scoring.test.ts
// Unit tests for the pure scoreQuestion function (D-17 partial-credit formula).
// This file is vitest-runnable — scoring.ts is pure TS with no Deno/npm imports.
// Analog: src/4-features/quiz-editor/model/questionReorder.test.ts

import { describe, it, expect } from 'vitest'
import { scoreQuestion } from './scoring'

describe('scoreQuestion — D-17 partial-credit formula', () => {
  it('all correct selected, none wrong → 1 (full credit)', () => {
    expect(
      scoreQuestion({
        correct_option_ids: ['a', 'b'],
        selected_option_ids: ['a', 'b'],
      }),
    ).toBe(1)
  })

  it('half the correct options selected, none wrong → 0.5 (partial credit)', () => {
    expect(
      scoreQuestion({
        correct_option_ids: ['a', 'b'],
        selected_option_ids: ['a'],
      }),
    ).toBe(0.5)
  })

  it('equal correct and incorrect selected → 0 (clamped, never negative)', () => {
    // 1 correct selected, 1 incorrect selected → (1 - 1) / 2 = 0
    expect(
      scoreQuestion({
        correct_option_ids: ['a', 'b'],
        selected_option_ids: ['a', 'c'], // 'a' correct, 'c' wrong
      }),
    ).toBe(0)
  })

  it('more incorrect than correct selected → 0 (clamped, never goes below 0)', () => {
    // 0 correct, 2 incorrect → (0 - 2) / 2 = -1 → clamped to 0
    expect(
      scoreQuestion({
        correct_option_ids: ['a', 'b'],
        selected_option_ids: ['c', 'd'],
      }),
    ).toBe(0)
  })

  it('totalCorrect 0 (malformed question) → 0', () => {
    expect(
      scoreQuestion({
        correct_option_ids: [],
        selected_option_ids: ['a'],
      }),
    ).toBe(0)
  })

  it('single-answer question answered correctly → 1', () => {
    expect(
      scoreQuestion({
        correct_option_ids: ['a'],
        selected_option_ids: ['a'],
      }),
    ).toBe(1)
  })

  it('single-answer question answered incorrectly → 0', () => {
    expect(
      scoreQuestion({
        correct_option_ids: ['a'],
        selected_option_ids: ['b'],
      }),
    ).toBe(0)
  })

  it('nothing selected → 0 (no credit for unanswered)', () => {
    expect(
      scoreQuestion({
        correct_option_ids: ['a', 'b'],
        selected_option_ids: [],
      }),
    ).toBe(0)
  })
})
