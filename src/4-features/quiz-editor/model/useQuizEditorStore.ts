import { ref, watch, nextTick } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { fetchQuiz, updateQuiz } from '@entities/quiz/api'
import {
  fetchQuestions,
  createQuestion,
  updateQuestion as apiUpdateQuestion,
  deleteQuestion as apiDeleteQuestion,
  reorderQuestions as apiReorderQuestions,
} from '@entities/question/api'
import {
  fetchAnswerOptions,
  createAnswerOption,
  updateAnswerOption as apiUpdateAnswerOption,
  deleteAnswerOption as apiDeleteAnswerOption,
} from '@entities/answer-option/api'
import type { Quiz } from '@entities/quiz/model'
import type { Question } from '@entities/question/model'
import type { AnswerOption } from '@entities/answer-option/model'
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
  const answerOptions = ref<Record<string, AnswerOption[]>>({})
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

      const loadedQuestions = await fetchQuestions(id)
      questions.value = loadedQuestions

      const options = await fetchAnswerOptions(loadedQuestions.map(q => q.id))
      const grouped: Record<string, AnswerOption[]> = {}
      for (const q of loadedQuestions) grouped[q.id] = []
      for (const option of options) (grouped[option.question_id] ??= []).push(option)
      answerOptions.value = grouped
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

  // ─── questions ────────────────────────────────────────────────────────────

  async function addQuestion(): Promise<string | null> {
    if (!quiz.value) return null
    try {
      const created = await createQuestion(quiz.value.id, questions.value.length)
      questions.value.push(created)
      answerOptions.value[created.id] = []
      return created.id
    } catch {
      toast.error(SAVE_ERROR)
      return null
    }
  }

  async function updateQuestion(id: string, patch: Partial<Question>) {
    const question = questions.value.find(q => q.id === id)
    if (question) Object.assign(question, patch)
    try {
      await apiUpdateQuestion(id, patch)
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  async function deleteQuestion(id: string) {
    try {
      await apiDeleteQuestion(id)
      const index = questions.value.findIndex(q => q.id === id)
      if (index !== -1) questions.value.splice(index, 1)
      delete answerOptions.value[id]
      questions.value.forEach((q, i) => { q.order_index = i })
      await apiReorderQuestions(questions.value)
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  async function reorderQuestions(reordered: Question[]) {
    reordered.forEach((q, i) => { q.order_index = i })
    if (reordered !== questions.value) {
      questions.value.splice(0, questions.value.length, ...reordered)
    }
    try {
      await apiReorderQuestions(questions.value)
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  // ─── answer options ───────────────────────────────────────────────────────

  async function addAnswerOption(questionId: string) {
    try {
      const list = answerOptions.value[questionId] ?? []
      const created = await createAnswerOption(questionId, list.length)
      ;(answerOptions.value[questionId] ??= []).push(created)
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  async function updateAnswerOption(id: string, patch: Partial<AnswerOption>) {
    let questionId: string | null = null
    let option: AnswerOption | null = null
    for (const [qid, list] of Object.entries(answerOptions.value)) {
      const found = list.find(o => o.id === id)
      if (found) {
        questionId = qid
        option = found
        break
      }
    }
    if (!option || !questionId) return

    try {
      // For single-answer questions, marking one option correct unmarks the rest.
      if (patch.is_correct === true) {
        const question = questions.value.find(q => q.id === questionId)
        if (question?.type === 'single') {
          const siblings = answerOptions.value[questionId].filter(
            o => o.id !== id && o.is_correct,
          )
          for (const sibling of siblings) {
            sibling.is_correct = false
            await apiUpdateAnswerOption(sibling.id, { is_correct: false })
          }
        }
      }
      Object.assign(option, patch)
      await apiUpdateAnswerOption(id, patch)
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  async function deleteAnswerOption(id: string) {
    try {
      await apiDeleteAnswerOption(id)
      for (const list of Object.values(answerOptions.value)) {
        const index = list.findIndex(o => o.id === id)
        if (index !== -1) {
          list.splice(index, 1)
          break
        }
      }
    } catch {
      toast.error(SAVE_ERROR)
    }
  }

  // ─── publish ──────────────────────────────────────────────────────────────

  function validateForPublish(): string | null {
    if (questions.value.length === 0) {
      return 'Добавьте хотя бы один вопрос, прежде чем публиковать тест.'
    }
    for (const question of questions.value) {
      const options = answerOptions.value[question.id] ?? []
      const label = question.body.trim() || 'без текста'
      if (options.length < 2) {
        return `Вопрос «${label}» должен иметь минимум 2 варианта ответа.`
      }
      if (!options.some(o => o.is_correct)) {
        return `Вопрос «${label}» должен иметь хотя бы один правильный ответ.`
      }
    }
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

  // ─── cover ────────────────────────────────────────────────────────────────

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
    answerOptions,
    title,
    description,
    timeLimit,
    settings,
    isLoading,
    isUploadingCover,
    loadQuiz,
    updateSettings,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    addAnswerOption,
    updateAnswerOption,
    deleteAnswerOption,
    validateForPublish,
    publishToggle,
    uploadCover,
    removeCover,
  }
})
