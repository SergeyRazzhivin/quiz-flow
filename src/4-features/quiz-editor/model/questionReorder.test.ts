import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@entities/quiz/api', () => ({
  fetchQuiz: vi.fn(),
  updateQuiz: vi.fn(),
}))
vi.mock('@entities/question/api', () => ({
  fetchQuestions: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  reorderQuestions: vi.fn(),
}))
vi.mock('@entities/answer-option/api', () => ({
  fetchAnswerOptions: vi.fn(),
  createAnswerOption: vi.fn(),
  updateAnswerOption: vi.fn(),
  deleteAnswerOption: vi.fn(),
}))
vi.mock('@shared/api/supabase', () => ({
  supabase: { storage: { from: vi.fn() } },
}))
vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import {
  reorderQuestions as apiReorderQuestions,
  deleteQuestion as apiDeleteQuestion,
} from '@entities/question/api'
import type { Question } from '@entities/question/model'
import type { AnswerOption } from '@entities/answer-option/model'
import { useQuizEditorStore } from './useQuizEditorStore'

function makeQuestion(id: string, orderIndex: number): Question {
  return {
    id,
    quiz_id: 'quiz-1',
    body: `Вопрос ${id}`,
    type: 'single',
    order_index: orderIndex,
    is_required: false,
  }
}

function makeOption(id: string, questionId: string, isCorrect: boolean): AnswerOption {
  return { id, question_id: questionId, body: id, is_correct: isCorrect, order_index: 0 }
}

describe('useQuizEditorStore — reorder, delete renumbering, publish validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('reorderQuestions assigns contiguous order_index 0..N-1 and batch-upserts', async () => {
    const store = useQuizEditorStore()
    store.questions = [makeQuestion('a', 5), makeQuestion('b', 9), makeQuestion('c', 2)]

    await store.reorderQuestions(store.questions)

    expect(store.questions.map(q => q.order_index)).toEqual([0, 1, 2])
    expect(apiReorderQuestions).toHaveBeenCalledOnce()
  })

  it('deleteQuestion removes the question and renumbers the rest contiguously', async () => {
    vi.mocked(apiDeleteQuestion).mockResolvedValue(undefined)
    const store = useQuizEditorStore()
    store.questions = [makeQuestion('a', 0), makeQuestion('b', 1), makeQuestion('c', 2)]

    await store.deleteQuestion('b')

    expect(store.questions.map(q => q.id)).toEqual(['a', 'c'])
    expect(store.questions.map(q => q.order_index)).toEqual([0, 1])
    expect(apiReorderQuestions).toHaveBeenCalledOnce()
  })

  it('validateForPublish errors on a question with <2 options and passes a valid quiz', () => {
    const store = useQuizEditorStore()
    store.questions = [makeQuestion('a', 0)]

    store.answerOptions = { a: [makeOption('o1', 'a', true)] }
    expect(store.validateForPublish()).not.toBeNull()

    store.answerOptions = {
      a: [makeOption('o1', 'a', true), makeOption('o2', 'a', false)],
    }
    expect(store.validateForPublish()).toBeNull()
  })

  it('validateForPublish errors when a question has no correct option', () => {
    const store = useQuizEditorStore()
    store.questions = [makeQuestion('a', 0)]
    store.answerOptions = {
      a: [makeOption('o1', 'a', false), makeOption('o2', 'a', false)],
    }
    expect(store.validateForPublish()).not.toBeNull()
  })
})
