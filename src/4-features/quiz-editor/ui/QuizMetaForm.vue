<script setup lang="ts">
import { computed } from 'vue'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import CoverUpload from './CoverUpload.vue'
import NavigationSettings from './NavigationSettings.vue'

const store = useQuizEditorStore()

const timeLimitMin = computed<number | null>(() =>
  store.timeLimit == null ? null : Math.round(store.timeLimit / 60),
)

function onTimeLimitInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.trim()
  if (raw === '') {
    store.timeLimit = null
    return
  }
  const minutes = Number(raw)
  store.timeLimit = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null
}
</script>

<template>
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-sm sm:p-6">
    <div class="flex flex-col gap-6 md:flex-row md:gap-7">
      <!-- Cover -->
      <div class="w-full shrink-0 md:w-[38%]">
        <CoverUpload />
      </div>

      <!-- Meta fields -->
      <div class="flex min-w-0 flex-1 flex-col">
        <label class="text-xs font-medium tracking-wide text-neutral-500 uppercase">
          Название теста
        </label>
        <input
          v-model="store.title"
          placeholder="Без названия"
          class="mt-1.5 w-full rounded-lg border border-neutral-800 bg-[#101010] px-3 py-2 text-2xl font-semibold text-neutral-50 transition-colors placeholder:text-neutral-600 hover:border-neutral-700 focus:border-orange-500 focus:outline-none"
        >

        <label class="mt-4 text-xs font-medium tracking-wide text-neutral-500 uppercase">
          Описание
        </label>
        <textarea
          v-model="store.description"
          rows="3"
          placeholder="Краткое описание теста (необязательно)"
          class="mt-1.5 w-full resize-none rounded-lg border border-neutral-800 bg-[#101010] px-3 py-2 text-sm text-neutral-200 shadow-sm placeholder:text-neutral-600 focus-visible:border-orange-500 focus-visible:outline-none"
        />

        <!-- Settings section -->
        <div class="mt-5 border-t border-neutral-800 pt-5">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-neutral-200">Лимит времени</span>
            <input
              :value="timeLimitMin ?? ''"
              type="number"
              min="1"
              placeholder="—"
              class="h-9 w-20 rounded-lg border border-neutral-800 bg-[#101010] px-3 py-1 text-sm text-neutral-100 text-center shadow-sm placeholder:text-neutral-600 focus-visible:border-orange-500 focus-visible:outline-none"
              @input="onTimeLimitInput"
            >
            <span class="text-sm text-neutral-400">мин</span>
            <span
              v-if="timeLimitMin == null"
              class="text-xs text-neutral-500"
            >
              · без ограничения
            </span>
          </div>

          <NavigationSettings class="mt-5" />
        </div>
      </div>
    </div>
  </div>
</template>
