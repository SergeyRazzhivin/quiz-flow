// src/5-entities/quiz-access/api.ts
// Owner-authenticated access link API.
// T-02-08: uses the authenticated supabase client — RLS owner_manage_quiz_access scopes rows.
// T-02-09: select list deliberately omits password_hash.
// NOTE: createAccessLink is via Edge Function (create-quiz-access), not direct Supabase insert.

import { supabase } from '@shared/api/supabase'
import type { QuizAccess } from './model'

export async function fetchAccessLinks(quizId: string): Promise<QuizAccess[]> {
  const { data, error } = await supabase
    .from('quiz_access')
    .select('id, quiz_id, token, login, label, expires_at')
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as QuizAccess[]
}

export async function deleteAccessLink(id: string): Promise<void> {
  const { error } = await supabase.from('quiz_access').delete().eq('id', id)
  if (error) throw error
}
