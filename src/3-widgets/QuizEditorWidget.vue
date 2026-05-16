<script setup lang="ts">
import { onMounted } from 'vue'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import QuizEditorHeader from './QuizEditorHeader.vue'
import QuizEditorFooter from './QuizEditorFooter.vue'

const props = defineProps<{ quizId: string }>()
const store = useQuizEditorStore()

onMounted(() => store.loadQuiz(props.quizId))
</script>

<template>
  <div class="quiz-editor-layout">
    <QuizEditorHeader />
    <main class="editor-body">
      <div class="mx-auto max-w-7xl px-6 py-6 text-sm text-gray-400">
        Редактор вопросов появится в следующем обновлении.
      </div>
    </main>
    <QuizEditorFooter />
  </div>
</template>

<style scoped>
.quiz-editor-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: calc(100dvh - 3.5rem); /* viewport minus the AppHeader (h-14) */
  overflow: hidden;
}
.editor-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  background-color: #f9fafb;
}
</style>
