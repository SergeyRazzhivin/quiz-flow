// evals/prompt.js
// IN-04: the eval's prompt-under-test is now DERIVED from the production
// SYSTEM_PROMPT in supabase/functions/_shared/quiz-prompt.ts instead of being
// copy-pasted into promptfooconfig.yaml. The pasted copy had already drifted
// (it omitted the "Если материала недостаточно…" line), so the gate was
// testing a prompt that did not match production. Importing the real constant
// here makes a future divergence impossible — promptfoo loads this file via a
// `file://evals/prompt.js:quizPrompt` reference in promptfooconfig.yaml.

import { SYSTEM_PROMPT } from '../supabase/functions/_shared/quiz-prompt.ts'

/**
 * Build the full prompt-under-test for a single eval case. The system rules are
 * the production SYSTEM_PROMPT verbatim; the per-case template vars
 * ({{requestedCount}}, {{difficulty}}, {{clarifyingPrompt}}, {{source}}) are
 * appended in the same shape buildUserPrompt() produces in production.
 */
export function quizPrompt({ vars }) {
  return [
    SYSTEM_PROMPT,
    '',
    `Количество вопросов: ${vars.requestedCount}`,
    `Уровень сложности: ${vars.difficulty}`,
    `На что сделать акцент (от автора теста): ${vars.clarifyingPrompt}`,
    '--- ИСХОДНЫЙ МАТЕРИАЛ ---',
    vars.source,
  ].join('\n')
}
