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
  <div class="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm sm:p-6">
    <!-- Top: cover + title / description -->
    <div class="flex flex-col gap-5 md:flex-row md:gap-7">
      <div class="w-full shrink-0 md:w-[38%]">
        <CoverUpload />
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <label class="text-xs font-medium tracking-wide text-neutral-500 uppercase">
          Название теста
        </label>
        <input
          v-model="store.title"
          placeholder="Без названия"
          class="mt-1.5 w-full rounded-lg border border-neutral-800 bg-[#101010] px-3 py-2 text-xl font-semibold text-neutral-50 transition-colors placeholder:text-neutral-600 hover:border-neutral-700 focus:border-orange-500 focus:outline-none"
        >

        <label class="mt-4 text-xs font-medium tracking-wide text-neutral-500 uppercase">
          Описание
        </label>
        <textarea
          v-model="store.description"
          placeholder="Краткое описание теста (необязательно)"
          class="mt-1.5 w-full flex-1 resize-none rounded-lg border border-neutral-800 bg-[#101010] px-3 py-2 text-sm leading-relaxed text-neutral-200 shadow-sm placeholder:text-neutral-600 focus-visible:border-orange-500 focus-visible:outline-none md:min-h-32"
        />
      </div>
    </div>

    <!-- Bottom: parameters, full width -->
    <div class="mt-6 grid gap-6 border-t border-neutral-800 pt-6 md:grid-cols-2 md:gap-8">
      <div>
        <p class="text-base font-semibold text-neutral-200">Лимит времени</p>
        <div class="mt-3 flex items-center gap-3">
          <input
            :value="timeLimitMin ?? ''"
            type="number"
            min="1"
            placeholder="—"
            class="h-9 w-20 rounded-lg border border-neutral-800 bg-[#101010] px-3 py-1 text-center text-sm text-neutral-100 shadow-sm placeholder:text-neutral-600 focus-visible:border-orange-500 focus-visible:outline-none"
            @input="onTimeLimitInput"
          >
          <span class="text-sm text-neutral-400">мин</span>
        </div>
        <p class="mt-2 text-xs text-neutral-500">
          {{ timeLimitMin == null
            ? 'Без ограничения — тестируемый проходит тест в своём темпе.'
            : 'По истечении времени тест завершается автоматически.' }}
        </p>
      </div>

      <NavigationSettings />
    </div>
  </div>
</template>
