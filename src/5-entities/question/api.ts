import { supabase } from '@shared/api/supabase'
import type { Question } from './model'

export async function fetchQuestions(quizId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data as unknown as Question[]
}

export async function createQuestion(quizId: string, orderIndex: number): Promise<Question> {
  const { data, error } = await supabase
    .from('questions')
    .insert({ quiz_id: quizId, body: '', type: 'single', order_index: orderIndex, is_required: false })
    .select()
    .single()
  if (error) throw error
  return data as unknown as Question
}

export async function updateQuestion(id: string, patch: Partial<Question>): Promise<void> {
  const { error } = await supabase.from('questions').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) throw error
}

// Persists order_index for a DnD reorder via per-row UPDATEs.
// NOT an upsert: upsert runs as `INSERT ... ON CONFLICT DO UPDATE`, and the
// INSERT phase fires the `enforce_question_limit` BEFORE INSERT trigger
// (migration 015) — which rejects the reorder for any owner already at their
// plan's question limit. Plain UPDATE does not fire INSERT triggers, and the
// `questions` table has no UNIQUE (quiz_id, order_index) constraint, so the
// transient duplicate order_index values between updates are safe.
export async function reorderQuestions(questions: Question[]): Promise<void> {
  const results = await Promise.all(
    questions.map((q, index) =>
      supabase.from('questions').update({ order_index: index }).eq('id', q.id),
    ),
  )
  const failed = results.find(r => r.error)
  if (failed?.error) throw failed.error
}
