<script setup lang="ts">
import { onMounted } from 'vue'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import QuizEditorHeader from './QuizEditorHeader.vue'
import QuestionList from './QuestionList.vue'
import QuizMetaForm from '@features/quiz-editor/ui/QuizMetaForm.vue'

const props = defineProps<{ quizId: string }>()
const store = useQuizEditorStore()

onMounted(() => store.loadQuiz(props.quizId))
</script>

<template>
  <div class="quiz-editor-layout">
    <QuizEditorHeader />
    <main class="editor-body">
      <div class="mx-auto max-w-7xl px-6 py-6">
        <QuizMetaForm />
        <div class="mt-8">
          <QuestionList />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.quiz-editor-layout {
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
}
.editor-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  background-color: #0a0a0a;
  /* Barely-perceptible dot grid for subtle depth. */
  background-image: radial-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 24px 24px;
  background-position: -12px -12px;
}
</style>
