import { supabase } from '@shared/api/supabase'
import type { AnswerOption } from './model'

export async function fetchAnswerOptions(questionIds: string[]): Promise<AnswerOption[]> {
  if (questionIds.length === 0) return []
  const { data, error } = await supabase
    .from('answer_options')
    .select('*')
    .in('question_id', questionIds)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data as unknown as AnswerOption[]
}

export async function createAnswerOption(
  questionId: string,
  orderIndex: number,
): Promise<AnswerOption> {
  const { data, error } = await supabase
    .from('answer_options')
    .insert({ question_id: questionId, body: '', is_correct: false, order_index: orderIndex })
    .select()
    .single()
  if (error) throw error
  return data as unknown as AnswerOption
}

export async function updateAnswerOption(
  id: string,
  patch: Partial<AnswerOption>,
): Promise<void> {
  const { error } = await supabase.from('answer_options').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteAnswerOption(id: string): Promise<void> {
  const { error } = await supabase.from('answer_options').delete().eq('id', id)
  if (error) throw error
}
