import { supabase } from '@shared/api/supabase'
import type { Database } from '@shared/api/database.types'
import type { Quiz } from './model'

type QuizInsert = Database['public']['Tables']['quizzes']['Insert']
type QuizUpdate = Database['public']['Tables']['quizzes']['Update']

export async function fetchMyQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*, question_count:questions(count)')
    .order('created_at', { ascending: false })
  if (error) throw error
  // Supabase returns the aggregate as `question_count: [{ count: N }]` — flatten it.
  return (data ?? []).map((row) => {
    const { question_count, ...rest } = row as Record<string, unknown>
    const agg = question_count as Array<{ count: number }> | null
    return { ...rest, question_count: agg?.[0]?.count ?? 0 }
  }) as unknown as Quiz[]
}

export async function fetchPublishedQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, description, cover_url, time_limit_sec')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as Quiz[]
}

export async function fetchCarouselQuizzes(limit = 12): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, description, cover_url, time_limit_sec, updated_at, question_count:questions(count)')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => {
    const { question_count, ...rest } = row as Record<string, unknown>
    const agg = question_count as Array<{ count: number }> | null
    return { ...rest, question_count: agg?.[0]?.count ?? 0 }
  }) as unknown as Quiz[]
}

export async function fetchQuiz(id: string): Promise<Quiz> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as Quiz
}

export async function createQuiz(): Promise<Quiz> {
  const { data: { user } } = await supabase.auth.getUser()
  const insert: QuizInsert = {
    title: 'Без названия',
    owner_id: user!.id,
    is_published: false,
    settings: {
      allow_back: true,
      show_stop_button: true,
      shuffle_questions: false,
      shuffle_answers: false
    }
  }
  const { data, error } = await supabase
    .from('quizzes')
    .insert(insert)
    .select()
    .single()
  if (error) throw error
  return data as unknown as Quiz
}

export async function updateQuiz(id: string, patch: Partial<Quiz>): Promise<void> {
  const { error } = await supabase
    .from('quizzes')
    .update(patch as QuizUpdate)
    .eq('id', id)
  if (error) throw error
}

export async function deleteQuiz(id: string): Promise<void> {
  const { error } = await supabase.from('quizzes').delete().eq('id', id)
  if (error) throw error
}
