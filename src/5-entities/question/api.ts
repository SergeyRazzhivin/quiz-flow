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

// Batch upsert for DnD reorder. Full rows are sent because `quiz_id` is
// NOT NULL with no default — a partial upsert would fail the INSERT path.
export async function reorderQuestions(questions: Question[]): Promise<void> {
  const { error } = await supabase.from('questions').upsert(
    questions.map(q => ({
      id: q.id,
      quiz_id: q.quiz_id,
      body: q.body,
      type: q.type,
      order_index: q.order_index,
      is_required: q.is_required,
    })),
  )
  if (error) throw error
}
