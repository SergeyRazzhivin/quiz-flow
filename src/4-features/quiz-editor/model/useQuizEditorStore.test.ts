import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('@entities/quiz/api', () => ({
  fetchQuiz: vi.fn(),
  updateQuiz: vi.fn(),
}))
vi.mock('@entities/question/api', () => ({
  fetchQuestions: vi.fn(),
}))
vi.mock('@shared/api/supabase', () => ({
  supabase: { storage: { from: vi.fn() } },
}))
vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { fetchQuiz, updateQuiz } from '@entities/quiz/api'
import { fetchQuestions } from '@entities/question/api'
import { toast } from 'vue-sonner'
import type { Quiz } from '@entities/quiz/model'
import { useQuizEditorStore } from './useQuizEditorStore'

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    owner_id: 'owner-1',
    title: 'Тест',
    description: 'Описание',
    cover_url: null,
    time_limit_sec: null,
    is_published: false,
    settings: {
      allow_back: true,
      show_stop_button: true,
      shuffle_questions: false,
      shuffle_answers: false,
      allow_retake: false,
    },
    created_at: '2026-05-17T00:00:00Z',
    updated_at: '2026-05-17T00:00:00Z',
    ...overrides,
  }
}

describe('useQuizEditorStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(fetchQuestions).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loadQuiz() populates quiz, title, and description from fetchQuiz', async () => {
    vi.mocked(fetchQuiz).mockResolvedValue(makeQuiz({ title: 'Загруженный', description: 'Текст' }))
    const store = useQuizEditorStore()

    await store.loadQuiz('quiz-1')

    expect(fetchQuiz).toHaveBeenCalledWith('quiz-1')
    expect(store.quiz?.id).toBe('quiz-1')
    expect(store.title).toBe('Загруженный')
    expect(store.description).toBe('Текст')
  })

  it('debounces metadata save: a title change calls updateQuiz once after 500ms', async () => {
    vi.mocked(fetchQuiz).mockResolvedValue(makeQuiz())
    const store = useQuizEditorStore()
    await store.loadQuiz('quiz-1')
    vi.mocked(updateQuiz).mockClear()

    store.title = 'Новое название'
    await nextTick()
    expect(updateQuiz).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(updateQuiz).toHaveBeenCalledOnce()
  })

  it('publishToggle() to publish with no questions does not publish and surfaces a validation error', async () => {
    vi.mocked(fetchQuiz).mockResolvedValue(makeQuiz({ is_published: false }))
    vi.mocked(fetchQuestions).mockResolvedValue([])
    const store = useQuizEditorStore()
    await store.loadQuiz('quiz-1')
    vi.mocked(updateQuiz).mockClear()

    await store.publishToggle()

    expect(toast.error).toHaveBeenCalled()
    expect(updateQuiz).not.toHaveBeenCalledWith('quiz-1', expect.objectContaining({ is_published: true }))
    expect(store.quiz?.is_published).toBe(false)
  })

  it('publishToggle() to unpublish calls updateQuiz with is_published false immediately', async () => {
    vi.mocked(fetchQuiz).mockResolvedValue(makeQuiz({ is_published: true }))
    vi.mocked(updateQuiz).mockResolvedValue(undefined)
    const store = useQuizEditorStore()
    await store.loadQuiz('quiz-1')
    vi.mocked(updateQuiz).mockClear()

    await store.publishToggle()

    expect(updateQuiz).toHaveBeenCalledWith('quiz-1', { is_published: false })
    expect(store.quiz?.is_published).toBe(false)
  })
})
