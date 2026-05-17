---
status: partial
phase: 02-quiz-taking-sharing
source: [02-VERIFICATION.md]
started: 2026-05-17T18:00:00Z
updated: 2026-05-17T18:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. D-02 superseded — immediate start after login
expected: Opening `/q/:token` and submitting the login form goes directly to question 1 of the active quiz — no intermediate intro/"Начать" preview screen.
result: [pending]

### 2. Timer critical state turns red
expected: On a timed quiz, the countdown in the sticky header turns red when ≤ 20% of the time limit remains.
result: [pending]

### 3. D-04 resume — answers survive reload
expected: Mid-quiz, reloading `/q/:token` resumes the same session at the same question with all previously selected answers intact; "Вперёд" is not blocked on an already-answered required question.
result: [pending]

### 4. D-04 allow_retake — fresh session on re-entry
expected: On a quiz with "Разрешить повторное прохождение" enabled, finishing then re-opening the link starts a brand-new attempt; a new `quiz_sessions` row is created and the final result reflects the new attempt.
result: [pending]

### 5. Timer expiry — overlay and auto-submit
expected: When a timed quiz reaches 0, the "Время вышло" overlay appears and the quiz auto-submits to the result page.
result: [pending]

### 6. Owner one-time credentials block
expected: Creating an access link shows the credentials block with the amber one-time warning; "Скопировать" copies link/login/password; the `quiz_access` row in Supabase stores only a bcrypt `password_hash`, never plaintext.
result: [pending]

### 7. TAKE-03 pre-login intro card
expected: `/q/:token` shows the quiz title, description, cover, and "N вопросов · M мин" before login, populated from the deployed `get-quiz-meta` Edge Function.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
