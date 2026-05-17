<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PerPersonRow } from '../model/useQuizStatsStore'
import { formatScore, formatShortDateTime } from '@shared/lib/format'

const props = defineProps<{
  rows: PerPersonRow[]
  totalQuestions: number
}>()

type SortKey = 'name' | 'score' | 'finished_at'
type SortDir = 'asc' | 'desc'

const sortKey = ref<SortKey>('finished_at')
const sortDir = ref<SortDir>('desc')

function toggleSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

const sortedRows = computed<PerPersonRow[]>(() => {
  // CR-02: guard against a NULL/undefined rows payload — never spread null.
  return [...(props.rows ?? [])].sort((a, b) => {
    let valA: string | number | null
    let valB: string | number | null

    if (sortKey.value === 'name') {
      valA = a.name ?? ''
      valB = b.name ?? ''
    } else if (sortKey.value === 'score') {
      valA = a.score ?? -1
      valB = b.score ?? -1
    } else {
      // WR-01: compare timestamps numerically — raw ISO string ordering is
      // unreliable across varying fractional-second / offset representations.
      valA = new Date(a.finished_at).getTime()
      valB = new Date(b.finished_at).getTime()
    }

    if (valA < valB) return sortDir.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})
</script>

<template>
  <!-- D-07: comparison table per UI-SPEC -->
  <div class="overflow-x-auto">
    <div class="min-w-[420px] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <!-- Header -->
      <div class="grid grid-cols-3 bg-neutral-800 px-4 py-2">
        <button
          class="text-left text-[13px] uppercase tracking-wide text-neutral-400 hover:text-neutral-200"
          @click="toggleSort('name')"
        >
          Имя
          <span v-if="sortKey === 'name'" class="ml-1">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
        </button>
        <button
          class="text-left text-[13px] uppercase tracking-wide text-neutral-400 hover:text-neutral-200"
          @click="toggleSort('score')"
        >
          Балл
          <span v-if="sortKey === 'score'" class="ml-1">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
        </button>
        <button
          class="text-left text-[13px] uppercase tracking-wide text-neutral-400 hover:text-neutral-200"
          @click="toggleSort('finished_at')"
        >
          Завершён
          <span v-if="sortKey === 'finished_at'" class="ml-1">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
        </button>
      </div>

      <!-- Body rows — WR-02: key on stable quiz_access_id, not a label+timestamp -->
      <div
        v-for="row in sortedRows"
        :key="row.quiz_access_id"
        class="grid grid-cols-3 border-t border-neutral-800 px-4 py-3 hover:bg-neutral-800/50"
      >
        <span class="truncate text-sm text-neutral-300">{{ row.name ?? '—' }}</span>
        <span class="text-sm text-neutral-300">{{ formatScore(row.score, totalQuestions) }}</span>
        <span class="text-sm text-neutral-400">{{ formatShortDateTime(row.finished_at) }}</span>
      </div>

      <!-- WR-03: started-but-never-finished quizzes have an empty perPerson — -->
      <!-- show an explanation row instead of a bare header. -->
      <div
        v-if="sortedRows.length === 0"
        class="border-t border-neutral-800 px-4 py-6 text-center text-sm text-neutral-500"
      >
        Никто пока не завершил тест
      </div>
    </div>
  </div>
</template>
