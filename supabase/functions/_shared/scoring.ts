// supabase/functions/_shared/scoring.ts
// Pure partial-credit scoring function (D-17).
// Framework-free: no Deno/npm imports — importable by both vitest and Edge Functions.
// RESEARCH.md Pattern 6.
//
// Per-question score formula:
//   totalCorrect = correct_option_ids.length
//   If totalCorrect === 0 → 0 (malformed question guard)
//   correctSelected  = count of selected ids that are in correct_option_ids
//   incorrectSelected = count of selected ids NOT in correct_option_ids
//   score = Math.max(0, (correctSelected - incorrectSelected) / totalCorrect)
//
// D-17: Single-answer questions are the 1-correct-option special case.
//   Correct → (1 - 0) / 1 = 1
//   Wrong   → (0 - 1) / 1 = -1 → clamped to 0

export interface ScoreQuestionInput {
  correct_option_ids: string[]
  selected_option_ids: string[]
}

/**
 * scoreQuestion — returns a fraction in [0, 1].
 * Never returns a negative value (clamped with Math.max).
 * Returns 0 for questions with no correct options (malformed question guard).
 */
export function scoreQuestion(input: ScoreQuestionInput): number {
  const { correct_option_ids, selected_option_ids } = input

  const totalCorrect = correct_option_ids.length
  if (totalCorrect === 0) return 0

  const correctSet = new Set(correct_option_ids)

  const correctSelected = selected_option_ids.filter((id) => correctSet.has(id)).length
  const incorrectSelected = selected_option_ids.filter((id) => !correctSet.has(id)).length

  return Math.max(0, (correctSelected - incorrectSelected) / totalCorrect)
}
