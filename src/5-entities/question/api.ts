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
