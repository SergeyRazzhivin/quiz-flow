<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { Question } from '@entities/question/model'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'

interface AnswerOption {
  id: string
  body: string
}

const props = defineProps<{
  question: Question
  selectedOptionIds: string[]
  options: AnswerOption[]
}>()

const store = useQuizTakingStore()

function isSelected(optionId: string): boolean {
  return props.selectedOptionIds.includes(optionId)
}

function handleSelect(optionId: string): void {
  store.selectAnswer(props.question.id, optionId, props.question.type)
}

const isRequiredAndUnanswered = () =>
  props.question.is_required && props.selectedOptionIds.length === 0
</script>

<template>
  <!-- UI-SPEC section 2: question card bg-neutral-900 rounded-2xl p-6 -->
  <div class="rounded-2xl bg-neutral-900 p-6">
    <!-- Question text -->
    <p class="mb-6 text-base text-neutral-50">
      {{ question.body }}
    </p>

    <!-- Answer options list -->
    <div class="flex flex-col gap-3">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        class="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
        :class="isSelected(option.id)
          ? 'border-orange-500 bg-neutral-800'
          : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'"
        @click="handleSelect(option.id)"
      >
        <!-- Radio/checkbox indicator (AnswerOptionEditor.vue visual language) -->
        <span
          class="flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors"
          :class="[
            question.type === 'single' ? 'rounded-full' : 'rounded-sm',
            isSelected(option.id)
              ? 'border-orange-500 bg-orange-500'
              : 'border-neutral-600 bg-neutral-900',
          ]"
        >
          <span
            v-if="question.type === 'single' && isSelected(option.id)"
            class="h-2 w-2 rounded-full bg-white"
          />
          <Check
            v-else-if="question.type === 'multiple' && isSelected(option.id)"
            class="h-3 w-3 text-white"
          />
        </span>

        <!-- Answer text -->
        <span class="flex-1 text-base text-neutral-50">{{ option.body }}</span>
      </button>
    </div>

    <!-- Required-question hint (D-07) — shown below options when required and unanswered -->
    <p
      v-if="isRequiredAndUnanswered()"
      class="mt-3 text-sm text-neutral-400"
    >
      Выберите ответ, чтобы продолжить.
    </p>
  </div>
</template>
