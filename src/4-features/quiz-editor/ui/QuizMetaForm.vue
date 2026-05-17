<script setup lang="ts">
import { computed } from 'vue'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import CoverUpload from './CoverUpload.vue'

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
  <div>
    <CoverUpload />

    <input
      v-model="store.title"
      placeholder="Без названия"
      class="mt-4 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold text-neutral-50 transition-colors hover:border-neutral-800 focus:border-neutral-700 focus:outline-none"
    >

    <textarea
      v-model="store.description"
      rows="5"
      placeholder="Описание теста (необязательно)"
      class="mt-2 w-full resize-none rounded-2xl border border-neutral-800 bg-[#101010] px-3 py-2 text-sm shadow-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
    />

    <div class="mt-2 flex items-center gap-2">
      <span class="text-sm text-neutral-400">Лимит времени</span>
      <input
        :value="timeLimitMin ?? ''"
        type="number"
        min="1"
        placeholder="—"
        class="h-9 w-20 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-sm shadow-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
        @input="onTimeLimitInput"
      >
      <span class="text-sm text-neutral-400">мин</span>
    </div>
  </div>
</template>
