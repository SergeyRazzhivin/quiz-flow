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
  position: relative;
  overflow-y: auto;
  overscroll-behavior: contain;
  background-color: #0a0a0a;
}
/* Dot grid that fades out toward the left/right edges. The pattern lives on a
   pseudo-element so the mask only affects the dots, not the content; z-index
   -1 keeps it behind the editor content but above the base background. */
.editor-body::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px);
  background-size: 24px 24px;
  background-position: -12px -12px;
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%,
    #000 22%,
    #000 78%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0%,
    #000 22%,
    #000 78%,
    transparent 100%
  );
}
</style>
