<script setup lang="ts">
import type { QuizStats } from '../model/useQuizStatsStore'
import { formatScore } from '@shared/lib/format'

defineProps<{
  stats: QuizStats | null
  completionRate: number
  isLoading: boolean
}>()
</script>

<template>
  <!-- D-07: summary cards with large numbers per UI-SPEC Component & Layout Inventory -->
  <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
    <!-- Loading skeletons -->
    <template v-if="isLoading">
      <div
        v-for="i in 3"
        :key="i"
        class="h-28 animate-pulse rounded-xl bg-neutral-800"
      />
    </template>

    <!-- Data cards -->
    <template v-else>
      <!-- Card 1: Всего попыток -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <p class="text-[13px] uppercase tracking-wide text-neutral-400">Всего попыток</p>
        <p class="mt-2 text-4xl font-semibold text-neutral-50">
          {{ stats?.totalAttempts ?? 0 }}
        </p>
      </div>

      <!-- Card 2: Процент завершений -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <p class="text-[13px] uppercase tracking-wide text-neutral-400">Процент завершений</p>
        <p class="mt-2 text-4xl font-semibold text-neutral-50">
          {{ completionRate }}%
        </p>
      </div>

      <!-- Card 3: Средний балл -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <p class="text-[13px] uppercase tracking-wide text-neutral-400">Средний балл</p>
        <p class="mt-2 text-4xl font-semibold text-neutral-50">
          {{ stats ? formatScore(stats.avgScore, stats.totalQuestions) : '—' }}
        </p>
      </div>
    </template>
  </div>
</template>
