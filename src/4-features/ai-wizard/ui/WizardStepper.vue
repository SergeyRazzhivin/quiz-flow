<script setup lang="ts">
// WizardStepper — a thin store-bound 4-marker progress indicator.
// Markers are NOT clickable (back-navigation is via the footer "Назад" only).
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

      <div class="flex flex-col items-center gap-1">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
          :class="
            store.step > s.n
              ? 'bg-orange-500 text-white'
              : store.step === s.n
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
      </div>
    </template>
  </nav>
</template>
