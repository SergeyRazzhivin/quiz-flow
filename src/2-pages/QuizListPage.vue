<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchPublishedQuizzes } from '@entities/quiz/api'
import type { Quiz } from '@entities/quiz/model'
import AppHeader from '@widgets/AppHeader.vue'
import QuizCard from '@entities/quiz/ui/QuizCard.vue'

const quizzes = ref<Quiz[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    quizzes.value = await fetchPublishedQuizzes()
  } catch {
    // no-op: empty list shown
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />
    <main class="mx-auto max-w-7xl px-6 py-8">
      <h1 class="mb-6 text-2xl font-semibold text-gray-900">
        Все тесты
      </h1>

      <div
        v-if="isLoading"
        class="text-sm text-gray-500"
      >
        Загрузка...
      </div>

      <p
        v-else-if="quizzes.length === 0"
        class="text-sm text-gray-500"
      >
        Пока нет опубликованных тестов.
      </p>

      <div
        v-else
        class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <QuizCard
          v-for="quiz in quizzes"
          :key="quiz.id"
          :quiz="quiz"
        />
      </div>
    </main>
  </div>
</template>
