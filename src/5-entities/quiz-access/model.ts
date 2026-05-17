// src/5-entities/quiz-access/model.ts
// QuizAccess domain model — password_hash is NEVER included (T-02-09).
// This interface is used by the owner client. The anon role cannot read quiz_access
// at all — the table has no anon RLS policy — so password_hash never reaches a guest.

export interface QuizAccess {
  id: string
  quiz_id: string
  token: string
  login: string
  label: string
  expires_at: string | null
}
