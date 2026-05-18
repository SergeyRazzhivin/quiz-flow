<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Sparkles } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { fetchMyQuizzes, createQuiz, deleteQuiz } from '@entities/quiz/api'
import type { Quiz } from '@entities/quiz/model'
import AppHeader from '@widgets/AppHeader.vue'
import AppFooter from '@widgets/AppFooter.vue'
import QuizCard from '@entities/quiz/ui/QuizCard.vue'
import EmptyState from '@features/quiz-list/ui/EmptyState.vue'
import DeleteQuizDialog from '@features/quiz-list/ui/DeleteQuizDialog.vue'
import Button from '@shared/ui/Button.vue'
import Tooltip from '@shared/ui/Tooltip.vue'

const router = useRouter()
const quizzes = ref<Quiz[]>([])
const isLoading = ref(true)
const deleteTarget = ref<Quiz | null>(null)

onMounted(async () => {
  try {
    quizzes.value = await fetchMyQuizzes()
  } catch {
    toast.error('Ошибка загрузки тестов. Проверьте соединение и попробуйте снова.')
  } finally {
    isLoading.value = false
  }
})

async function handleCreate() {
  try {
    const quiz = await createQuiz()
    toast.success('Тест создан. Добавьте вопросы.')
    router.push('/editor/' + quiz.id)
  } catch (e) {
    // The DB enforces the Free quiz limit via a BEFORE INSERT trigger
    // (migration 015) — surface it as an upsell instead of a generic error.
    // Supabase errors are plain objects, not Error instances — read .message directly.
    const message = (e as { message?: string } | null)?.message ?? ''
    if (message.includes('QUIZ_LIMIT_EXCEEDED')) {
      toast.error('Достигнут лимит Free-плана — 3 теста. Перейдите на Pro для неограниченного количества тестов.', {
        action: { label: 'Тарифы', onClick: () => router.push('/billing') },
      })
    } else {
      toast.error('Не удалось создать тест. Попробуйте снова.')
    }
  }
}

async function handleConfirmDelete() {
  if (!deleteTarget.value) return
  const id = deleteTarget.value.id
  deleteTarget.value = null
  try {
    await deleteQuiz(id)
    quizzes.value = quizzes.value.filter(q => q.id !== id)
    toast.success('Тест удалён.')
  } catch {
    toast.error('Ошибка удаления. Проверьте соединение и попробуйте снова.')
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div class="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-semibold text-neutral-50">
          Мои тесты
        </h1>
        <div
          v-if="quizzes.length > 0"
          class="flex items-center gap-3"
        >
          <Tooltip content="Сгенерировать новый тест из текста или файла">
            <Button
              variant="outline"
              @click="router.push('/ai-wizard')"
            >
              <Sparkles class="h-4 w-4" />
              Создать с ИИ
            </Button>
          </Tooltip>
          <Button
            variant="outline"
            @click="handleCreate"
          >
            <Plus class="h-4 w-4" />
            Создать тест
          </Button>
        </div>
      </div>

      <div
        v-if="isLoading"
        class="text-sm text-neutral-400"
      >
        Загрузка...
      </div>

      <EmptyState
        v-else-if="quizzes.length === 0"
        @create="handleCreate"
        @create-ai="router.push('/ai-wizard')"
      />

      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      >
        <QuizCard
          v-for="quiz in quizzes"
          :key="quiz.id"
          :quiz="quiz"
          :show-actions="true"
          @delete="deleteTarget = $event"
        />
      </div>
    </main>
    <AppFooter />

    <DeleteQuizDialog
      :open="!!deleteTarget"
      @update:open="val => { if (!val) deleteTarget = null }"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>
