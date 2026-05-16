export type QuestionType = 'single' | 'multiple'

export interface Question {
  id: string
  quiz_id: string
  body: string
  type: QuestionType
  order_index: number
  is_required: boolean
}
