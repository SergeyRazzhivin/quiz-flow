import { ref, watch, nextTick } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { fetchQuiz, updateQuiz } from '@entities/quiz/api'
import { fetchQuestions } from '@entities/question/api'
import type { Quiz } from '@entities/quiz/model'
import type { Question } from '@entities/question/model'
import type { QuizSettings } from '@shared/types'
import { supabase } from '@shared/api/supabase'
import { resizeImageToMaxWidth } from '@shared/lib/image'
import { useDebounceFn } from '@shared/lib/debounce'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

const DEFAULT_SETTINGS: QuizSettings = {
  allow_back: true,
  show_stop_button: true,
  shuffle_questions: false,
  shuffle_answers: false,
}

const SAVE_ERROR = 'Ошибка сохранения. Проверьте соединение и попробуйте снова.'

export const useQuizEditorStore = defineStore('quiz-editor', () => {
  const quiz = ref<Quiz | null>(null)
  const questions = ref<Question[]>([])
  const title = ref('')
  const description = ref('')
  const timeLimit = ref<number | null>(null)
  const settings = ref<QuizSettings>({ ...DEFAULT_SETTINGS })
  const isLoading = ref(false)
  const isUploadingCover = ref(false)

  // Suppresses the auto-save watcher while loadQuiz populates the refs.
  let suppressSave = false

  async function saveMetadata() {
    if (!quiz.value) return
    try {
      await updateQuiz(quiz.value.id, {
        title: title.value,
        description: description.value || null,
        time_limit_sec: timeLimit.value,
      })
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  const debouncedSave = useDebounceFn(() => { void saveMetadata() }, 500)

  watch([title, description, timeLimit], () => {
    if (suppressSave || !quiz.value) return
    debouncedSave()
  })

  async function loadQuiz(id: string) {
    isLoading.value = true
    suppressSave = true
    try {
      const loaded = await fetchQuiz(id)
      quiz.value = loaded
      title.value = loaded.title
      description.value = loaded.description ?? ''
      timeLimit.value = loaded.time_limit_sec
      settings.value = { ...DEFAULT_SETTINGS, ...loaded.settings }
      questions.value = await fetchQuestions(id)
    } catch {
      toast.error('Не удалось загрузить тест. Проверьте соединение и попробуйте снова.')
    } finally {
      isLoading.value = false
      await nextTick()
      suppressSave = false
    }
  }

  async function updateSettings(patch: Partial<QuizSettings>) {
    if (!quiz.value) return
    const next = { ...settings.value, ...patch }
    settings.value = next
    try {
      await updateQuiz(quiz.value.id, { settings: next })
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  // Extended in Plan 04 with per-question answer-option checks.
  function validateForPublish(): string | null {
    if (questions.value.length === 0) return 'Добавьте хотя бы один вопрос, прежде чем публиковать тест.'
    return null
  }

  async function publishToggle() {
    if (!quiz.value) return
    const next = !quiz.value.is_published
    if (next) {
      const error = validateForPublish()
      if (error) {
        toast.error(error)
        return
      }
    }
    try {
      await updateQuiz(quiz.value.id, { is_published: next })
      quiz.value.is_published = next
      toast.success(next ? 'Тест опубликован' : 'Тест снят с публикации')
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  async function uploadCover(file: File) {
    if (!quiz.value) return
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_BYTES) {
      toast.error('Поддерживаются только JPEG, PNG и WebP. Максимальный размер — 5 МБ.')
      return
    }
    isUploadingCover.value = true
    try {
      const resized = await resizeImageToMaxWidth(file, 1280)
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
      const path = `${quiz.value.owner_id}/${quiz.value.id}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('covers').upload(path, resized)
      if (error) throw error
      const { data } = supabase.storage.from('covers').getPublicUrl(path)
      await updateQuiz(quiz.value.id, { cover_url: data.publicUrl })
      quiz.value.cover_url = data.publicUrl
      toast.success('Обложка загружена')
    } catch {
      toast.error('Ошибка загрузки обложки. Попробуйте снова.')
    } finally {
      isUploadingCover.value = false
    }
  }

  async function removeCover() {
    if (!quiz.value) return
    try {
      await updateQuiz(quiz.value.id, { cover_url: null })
      quiz.value.cover_url = null
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  return {
    quiz,
    questions,
    title,
    description,
    timeLimit,
    settings,
    isLoading,
    isUploadingCover,
    loadQuiz,
    updateSettings,
    publishToggle,
    uploadCover,
    removeCover,
  }
})
