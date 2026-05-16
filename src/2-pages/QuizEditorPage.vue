<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Monitor } from 'lucide-vue-next'
import AppHeader from '@widgets/AppHeader.vue'
import QuizEditorWidget from '@widgets/QuizEditorWidget.vue'

const route = useRoute()
const quizId = route.params.id as string
</script>

<template>
  <div class="hidden h-dvh flex-col md:flex">
    <AppHeader />
    <QuizEditorWidget
      :quiz-id="quizId"
      class="min-h-0 flex-1"
    />
  </div>
  <div class="flex min-h-screen flex-col items-center justify-center p-6 text-center md:hidden">
    <Monitor class="h-12 w-12 text-neutral-600" />
    <p class="mt-4 text-base text-neutral-400">
      Для редактирования теста откройте страницу на компьютере.
    </p>
  </div>
</template>
