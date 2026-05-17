// src/5-entities/quiz-access/model.ts
// QuizAccess domain model — password_hash is NEVER included (T-02-09).
// This interface is used by the owner client; the anon role also cannot see password_hash
// per column-level grants (migration 009).

export interface QuizAccess {
  id: string
  quiz_id: string
  token: string
  login: string
  label: string
  expires_at: string | null
}
