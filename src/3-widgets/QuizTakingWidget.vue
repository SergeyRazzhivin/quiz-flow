<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ClipboardX, LinkIcon } from 'lucide-vue-next'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'
import QuizIntroScreen from '@features/quiz-taking/ui/QuizIntroScreen.vue'
import GracefulState from '@features/quiz-taking/ui/GracefulState.vue'
import StopConfirmDialog from '@features/quiz-taking/ui/StopConfirmDialog.vue'
import TimerExpiredNotice from '@features/quiz-taking/ui/TimerExpiredNotice.vue'
import QuizTakingHeader from './QuizTakingHeader.vue'
import QuestionTaker from '@features/quiz-taking/ui/QuestionTaker.vue'
import NavigationControls from '@features/quiz-taking/ui/NavigationControls.vue'

const route = useRoute()
const store = useQuizTakingStore()

// Stop/finish dialog — shared between the header "Стоп" button and the last-question "Завершить" button
const stopDialogOpen = ref(false)

onMounted(() => {
  const token = route.params.token as string
  void store.init(token)
})

onUnmounted(() => {
  store.cleanup()
})

// Answer options for the current question — the questions from verify-quiz-access
// include answer_options_public nested inside them (raw DB shape from the EF response).
interface AnswerOption {
  id: string
  body: string
}

const currentOptions = computed<AnswerOption[]>(() => {
  const q = store.currentQuestion
  if (!q) return []
  // The raw question object from the EF response has answer_options_public nested
  const raw = q as unknown as { answer_options_public?: AnswerOption[] }
  return raw.answer_options_public ?? []
})

const selectedOptionIds = computed<string[]>(() => {
  const q = store.currentQuestion
  if (!q) return []
  return store.answers[q.id] ?? []
})

const isFirstQuestion = computed<boolean>(() => store.currentQuestionIndex === 0)

// D-08: show the TimerExpiredNotice overlay when the timer has hit zero and the auto-submit
// is in flight. Manual stop does not trigger this (timer is still > 0 when confirmed).
const showTimerExpiredNotice = computed<boolean>(
  () =>
    store.isSubmitting &&
    store.timeLimitSec !== null &&
    store.timeRemainingSeconds <= 0,
)
</script>

<template>
  <!-- idle → intro card + login form on one screen (D-01) -->
  <QuizIntroScreen v-if="store.sessionStatus === 'idle'" />

  <!-- not_ready → quiz has zero questions (D-19) -->
  <GracefulState
    v-else-if="store.sessionStatus === 'not_ready'"
    :icon="ClipboardX"
    heading="Тест пока не готов"
    body="Автор ещё не добавил вопросы. Попробуйте зайти позже."
  />

  <!-- invalid → expired or bad token -->
  <GracefulState
    v-else-if="store.sessionStatus === 'invalid'"
    :icon="LinkIcon"
    heading="Ссылка недействительна"
    body="Ссылка устарела или была отозвана. Обратитесь к автору теста."
  />

  <!-- active → full question-taking UI (100dvh two-row grid: header + scrollable body) -->
  <div
    v-else-if="store.sessionStatus === 'active'"
    class="taking-layout"
  >
    <!-- Sticky header: progress + timer + stop (D-05/D-06/D-09) -->
    <QuizTakingHeader v-model:stop-dialog-open="stopDialogOpen" />

    <!-- Scrollable body: question card + navigation footer.
         Outer container is on the app's 1280px grid (max-w-6xl mx-auto px-6),
         matching AppHeader/QuizEditorWidget. The question card sits in a centered
         max-w-3xl reading column so it is not stretched edge-to-edge. -->
    <main class="taking-body">
      <div class="mx-auto flex w-full max-w-6xl flex-col px-6 py-6">
        <div class="mx-auto w-full max-w-3xl">
          <QuestionTaker
            v-if="store.currentQuestion"
            :question="store.currentQuestion"
            :selected-option-ids="selectedOptionIds"
            :options="currentOptions"
          />

          <NavigationControls
            class="mt-4"
            :can-go-back="store.canGoBack"
            :allow-back="store.quiz?.settings?.allow_back ?? false"
            :can-go-forward="store.canGoForward"
            :is-last-question="store.isLastQuestion"
            :is-first-question="isFirstQuestion"
            @back="store.goBack()"
            @forward="store.goForward()"
            @finish="stopDialogOpen = true"
          />
        </div>
      </div>
    </main>

    <!-- Stop/finish confirmation dialog — shared between Стоп and Завершить (D-06) -->
    <StopConfirmDialog v-model:open="stopDialogOpen" />

    <!-- D-08: Timer-expired overlay — non-dismissible, shown while auto-submit is in flight.
         Only shown when isSubmitting + timer hit zero (not for manual Стоп confirm). -->
    <TimerExpiredNotice v-if="showTimerExpiredNotice" />
  </div>
</template>

<style scoped>
/* Two-row grid layout: sticky header auto + scrollable body 1fr (analog: QuizEditorWidget.vue) */
.taking-layout {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100dvh;
  overflow: hidden;
}

.taking-body {
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
