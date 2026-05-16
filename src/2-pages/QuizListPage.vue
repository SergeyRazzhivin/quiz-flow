<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchPublishedQuizzes } from '@entities/quiz/api'
import type { Quiz } from '@entities/quiz/model'

const quizzes = ref<Quiz[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    quizzes.value = await fetchPublishedQuizzes()
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Ошибка загрузки тестов'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="mx-auto max-w-5xl px-4 py-8">
      <h1 class="mb-6 text-2xl font-bold text-gray-900">Опубликованные тесты</h1>

      <div v-if="isLoading" class="text-gray-500">Загрузка...</div>

      <div v-else-if="error" class="text-red-500">{{ error }}</div>

      <div v-else-if="quizzes.length === 0" class="text-gray-500">
        Опубликованных тестов пока нет.
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="quiz in quizzes"
          :key="quiz.id"
          class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <h2 class="font-semibold text-gray-900">{{ quiz.title }}</h2>
          <p v-if="quiz.description" class="mt-1 text-sm text-gray-500">
            {{ quiz.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
