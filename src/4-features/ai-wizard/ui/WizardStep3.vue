<script setup lang="ts">
// Step 3 — generation parameters (AI-04). Question count (D-07) + 3-level
// difficulty (D-08) + an optional difficulty prompt. No question-type
// selector (D-09 — the AI decides). Copy verbatim from 03-UI-SPEC "Step 3".
import { computed } from 'vue'
import { useAiWizardStore } from '@features/ai-wizard/model/useAiWizardStore'
import Input from '@shared/ui/Input.vue'

const store = useAiWizardStore()

const difficulties = [
  { value: 'easy', label: 'Лёгкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'hard', label: 'Сложный' },
] as const

const countInvalid = computed(
  () =>
    store.form.questionCount < 1 ||
    store.form.questionCount > store.planMaxQuestions,
)

// WR-02: keep the question-count input from desyncing UI validation from the
// EF's `Number.isInteger(count) && count >= 1` check. A blank / non-numeric
// entry → 0 (rejected by isStepValid), and `1e3` / `10.5` are truncated to a
// plain integer so what the user sees is exactly what is sent. An over-plan
// value is still allowed into the field so `countInvalid` can show the hint —
// the EF remains the source of truth (constraint #4).
function onCountInput(value: string | number): void {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    store.form.questionCount = 0
    return
  }
  store.form.questionCount = Math.trunc(n)
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold text-neutral-50">Шаг 3. Параметры генерации</h2>

    <!-- Question count (D-07) -->
    <div class="space-y-2">
      <label
        for="wizard-count"
        class="block text-sm font-semibold text-neutral-200"
      >
        Количество вопросов
      </label>
      <Input
        id="wizard-count"
        :model-value="store.form.questionCount"
        type="number"
        min="1"
        :max="store.planMaxQuestions"
        step="1"
        class="w-24"
        @update:model-value="onCountInput"
      />
      <p
        v-if="countInvalid"
        class="text-xs text-red-400"
      >
        Укажите число от 1 до {{ store.planMaxQuestions }}
      </p>
      <p
        v-else
        class="text-xs text-neutral-500"
      >
        От 1 до {{ store.planMaxQuestions }}
      </p>
    </div>

    <!-- Difficulty (D-08) — 3-segment single-select control -->
    <div class="space-y-2">
      <span class="block text-sm font-semibold text-neutral-200">Сложность</span>
      <div class="inline-flex h-9 w-full items-center justify-center rounded-lg bg-neutral-800 p-1">
        <button
          v-for="d in difficulties"
          :key="d.value"
          type="button"
          class="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          :class="
            store.form.difficulty === d.value
              ? 'bg-neutral-900 text-neutral-50 shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          "
          @click="store.form.difficulty = d.value"
        >
          {{ d.label }}
        </button>
      </div>
    </div>

    <!-- Optional difficulty prompt (D-08) -->
    <div class="space-y-2">
      <label
        for="wizard-diff-prompt"
        class="block text-sm font-semibold text-neutral-200"
      >
        Уточнение по сложности (необязательно)
      </label>
      <textarea
        id="wizard-diff-prompt"
        v-model="store.form.difficultyPrompt"
        rows="2"
        placeholder="Например: больше вопросов на применение, чем на запоминание"
        class="w-full rounded-2xl border border-neutral-800 bg-[#101010] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
      />
    </div>
  </div>
</template>
