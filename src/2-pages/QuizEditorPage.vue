<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppHeader from '@widgets/AppHeader.vue'
import QuizEditorWidget from '@widgets/QuizEditorWidget.vue'

const route = useRoute()
const quizId = route.params.id as string
</script>

<template>
  <div class="flex h-dvh flex-col">
    <AppHeader />
    <QuizEditorWidget
      :quiz-id="quizId"
      class="min-h-0 flex-1"
    />
  </div>
</template>
