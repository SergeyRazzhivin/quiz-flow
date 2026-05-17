<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { BarChart3 } from 'lucide-vue-next'
import { useQuizStatsStore } from '@features/quiz-stats/model/useQuizStatsStore'
import SummaryCards from '@features/quiz-stats/ui/SummaryCards.vue'
import ResultsTable from '@features/quiz-stats/ui/ResultsTable.vue'
import AccuracySection from '@features/quiz-stats/ui/AccuracySection.vue'
import AppHeader from './AppHeader.vue'

const route = useRoute()
const store = useQuizStatsStore()

onMounted(() => {
  void store.loadStats(route.params.id as string)
})
</script>

<template>
  <!-- Page shell: min-h-[100dvh] per UI-SPEC (never 100vh) -->
  <div class="min-h-[100dvh] bg-neutral-950">
    <AppHeader />

    <main class="mx-auto max-w-5xl px-4 py-12">
      <h1 class="mb-8 text-xl font-semibold text-neutral-50">Статистика</h1>

      <!-- Loading branch: skeleton layout -->
      <template v-if="store.isLoading">
        <SummaryCards :stats="null" :completion-rate="0" :is-loading="true" />
        <div class="mt-8 h-40 animate-pulse rounded-xl bg-neutral-800" />
        <div class="mt-8 h-40 animate-pulse rounded-xl bg-neutral-800" />
      </template>

      <!-- Error branch -->
      <div
        v-else-if="store.error"
        class="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-12 text-center"
      >
        <h2 class="text-xl font-semibold text-neutral-50">Не удалось загрузить статистику</h2>
        <p class="mt-2 text-base text-neutral-400">
          Проверьте подключение и попробуйте обновить страницу.
        </p>
      </div>

      <!-- D-08: Empty state — friendly message when no one has attempted yet -->
      <div
        v-else-if="store.stats && store.stats.totalAttempts === 0"
        class="flex min-h-[400px] flex-col items-center justify-center py-16"
      >
        <BarChart3 class="h-12 w-12 text-neutral-600" />
        <h2 class="mt-6 text-xl font-semibold text-neutral-50">Пока никто не проходил тест</h2>
        <p class="mt-2 max-w-sm text-center text-base text-neutral-400">
          Поделитесь ссылкой на тест — здесь появится статистика по попыткам и результатам.
        </p>
      </div>

      <!-- Data branch: full stats -->
      <template v-else-if="store.stats">
        <div class="flex flex-col gap-8">
          <SummaryCards
            :stats="store.stats"
            :completion-rate="store.completionRate"
            :is-loading="false"
          />
          <ResultsTable
            :rows="store.stats.perPerson"
            :total-questions="store.stats.totalQuestions"
          />
          <AccuracySection
            :accuracy="store.accuracy"
            :is-pro="store.isPro"
          />
        </div>
      </template>
    </main>
  </div>
</template>
