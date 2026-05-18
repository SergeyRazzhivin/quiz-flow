import type { QuizSettings } from '@shared/types'

export interface Quiz {
  id: string
  owner_id: string
  title: string
  description: string | null
  cover_url: string | null
  time_limit_sec: number | null
  is_published: boolean
  settings: QuizSettings
  created_at: string
  updated_at: string
  /** Number of questions in the quiz. Populated by fetchMyQuizzes; undefined elsewhere. */
  question_count?: number
}
