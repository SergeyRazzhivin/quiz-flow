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
      <div class="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
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
  /* Transparent — the global #app dot-grid backdrop shows through. */
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
