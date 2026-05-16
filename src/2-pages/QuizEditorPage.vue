<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Monitor } from 'lucide-vue-next'
import QuizEditorWidget from '@widgets/QuizEditorWidget.vue'

const route = useRoute()
const quizId = route.params.id as string
</script>

<template>
  <div class="hidden h-full md:block">
    <QuizEditorWidget :quiz-id="quizId" />
  </div>
  <div class="flex min-h-screen flex-col items-center justify-center p-6 text-center md:hidden">
    <Monitor class="h-12 w-12 text-gray-300" />
    <p class="mt-4 text-base text-gray-500">
      Для редактирования теста откройте страницу на компьютере.
    </p>
  </div>
</template>
