<script setup lang="ts">
// WizardStepper — a thin store-bound 4-marker progress indicator.
// Completed (earlier) markers are clickable to jump back; the active and
// upcoming markers, and all markers during generation (step 4), are not.
// States/colors per 03-UI-SPEC "Stepper".
import { Check } from 'lucide-vue-next'
import { useAiWizardStore } from '@features/ai-wizard/model/useAiWizardStore'

const store = useAiWizardStore()

const steps = [
  { n: 1, label: 'Название' },
  { n: 2, label: 'Материал' },
  { n: 3, label: 'Параметры' },
  { n: 4, label: 'Генерация' },
] as const

// Only earlier steps are navigable, and never while generation runs (step 4).
function canNavigate(n: number): boolean {
  return n < store.step && store.step !== 4
}

function goToStep(n: 1 | 2 | 3 | 4): void {
  if (canNavigate(n)) store.step = n
}
</script>

<template>
  <nav
    class="flex items-start"
    aria-label="Шаги мастера"
  >
    <template
      v-for="(s, i) in steps"
      :key="s.n"
    >
      <!-- Connector before every marker except the first -->
      <div
        v-if="i > 0"
        class="mt-3.5 h-0.5 flex-1"
        :class="store.step >= s.n ? 'bg-orange-500' : 'bg-neutral-800'"
      />

      <button
        type="button"
        :disabled="!canNavigate(s.n)"
        class="flex flex-col items-center gap-1 transition-opacity enabled:cursor-pointer enabled:hover:opacity-80 disabled:cursor-default"
        @click="goToStep(s.n)"
      >
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
          :class="
            store.step >= s.n
              ? 'bg-orange-500 text-white'
              : 'bg-neutral-800 text-neutral-500'
          "
        >
          <Check
            v-if="store.step > s.n"
            class="h-4 w-4"
          />
          <span v-else>{{ s.n }}</span>
        </div>
        <span
          class="text-xs"
          :class="store.step === s.n ? 'text-neutral-50' : 'text-neutral-500'"
        >
          {{ s.label }}
        </span>
      </button>
    </template>
  </nav>
</template>
