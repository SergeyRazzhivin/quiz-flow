<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { fetchMyQuizzes, createQuiz, deleteQuiz } from '@entities/quiz/api'
import type { Quiz } from '@entities/quiz/model'
import AppHeader from '@widgets/AppHeader.vue'
import QuizCard from '@entities/quiz/ui/QuizCard.vue'
import EmptyState from '@features/quiz-list/ui/EmptyState.vue'
import DeleteQuizDialog from '@features/quiz-list/ui/DeleteQuizDialog.vue'
import Button from '@shared/ui/Button.vue'

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
  } catch {
    toast.error('Не удалось создать тест. Попробуйте снова.')
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
  <div class="min-h-screen bg-neutral-950">
    <AppHeader />
    <main class="mx-auto max-w-7xl px-6 py-8">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-semibold text-neutral-50">
          Мои тесты
        </h1>
        <Button
          v-if="quizzes.length > 0"
          @click="handleCreate"
        >
          <Plus class="h-4 w-4" />
          Создать тест
        </Button>
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
      />

      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
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

    <DeleteQuizDialog
      :open="!!deleteTarget"
      @update:open="val => { if (!val) deleteTarget = null }"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>
