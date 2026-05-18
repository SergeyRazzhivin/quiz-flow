<script setup lang="ts">
import { StopCircle } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import ProgressBar from '@shared/ui/ProgressBar.vue'
import TimerDisplay from '@shared/ui/TimerDisplay.vue'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'

// The stop dialog is lifted to QuizTakingWidget so it's shared between
// the header "Стоп" button and the last-question "Завершить" button.
defineProps<{
  stopDialogOpen: boolean
}>()

const emit = defineEmits<{
  'update:stopDialogOpen': [value: boolean]
}>()

const store = useQuizTakingStore()
</script>

<template>
  <!-- UI-SPEC section 2 TakingHeader: h-14, bg-neutral-900 border-b border-neutral-800.
       Outer header is the full-width sticky bar; inner div aligns content to the
       app's 1280px grid (max-w-6xl mx-auto px-6) — same pattern as AppHeader.vue. -->
  <header class="border-b border-neutral-800 bg-neutral-900">
    <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-6">
      <!-- Left section (flex-1): progress label + progress bar -->
      <div class="flex flex-1 flex-col gap-1">
        <span class="text-sm text-neutral-400">
          Вопрос {{ store.currentQuestionIndex + 1 }} из {{ store.questions.length }}
        </span>
        <ProgressBar :value="store.progressPercent" />
      </div>

      <!-- Right section (shrink-0): timer (conditional D-09) + stop button (conditional D-06) -->
      <div class="flex shrink-0 items-center gap-3">
        <!-- D-09: timer rendered only when time_limit_sec is non-null -->
        <TimerDisplay
          v-if="store.timeLimitSec"
          :seconds="store.timeRemainingSeconds"
          :is-alert="store.isTimerCritical"
        />

        <!-- D-06: stop button rendered only when show_stop_button is true in quiz settings -->
        <Button
          v-if="store.quiz?.settings?.show_stop_button"
          variant="ghost"
          size="sm"
          @click="emit('update:stopDialogOpen', true)"
        >
          <StopCircle class="h-4 w-4" />
          Стоп
        </Button>
      </div>
    </div>
  </header>
</template>
