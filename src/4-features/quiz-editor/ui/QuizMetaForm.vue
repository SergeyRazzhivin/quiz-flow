<script setup lang="ts">
import { computed } from 'vue'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'

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
  <div class="flex flex-1 items-start gap-4">
    <textarea
      v-model="store.description"
      rows="2"
      placeholder="Описание теста (необязательно)"
      class="flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
    />
    <div class="flex items-center gap-2">
      <input
        :value="timeLimitMin ?? ''"
        type="number"
        min="1"
        placeholder="—"
        class="h-9 w-20 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
        @input="onTimeLimitInput"
      >
      <span class="text-sm text-gray-500">мин</span>
    </div>
  </div>
</template>
