<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Lock } from 'lucide-vue-next'
import type { AccuracyRow } from '../model/useQuizStatsStore'
import { formatPercent } from '@shared/lib/format'
import ProgressBar from '@shared/ui/ProgressBar.vue'
import Button from '@shared/ui/Button.vue'

defineProps<{
  accuracy: AccuracyRow[] | null
  isPro: boolean
}>()

const router = useRouter()
</script>

<template>
  <!-- D-07: horizontal progress bars + D-06 Pro gate per UI-SPEC -->
  <div class="relative rounded-xl border border-neutral-800 bg-neutral-900 p-6">
    <h2 class="mb-4 text-xl font-semibold text-neutral-50">Точность по вопросам</h2>

    <!-- Free owner: skeleton bars + blur overlay (D-06 — no real numbers rendered) -->
    <template v-if="!isPro">
      <div
        v-for="i in 4"
        :key="i"
        class="mb-3 h-6 animate-pulse rounded bg-neutral-800"
      />
      <!-- Blur + CTA overlay -->
      <div
        class="absolute inset-0 flex flex-col items-center justify-center rounded-xl backdrop-blur-md bg-neutral-950/60"
      >
        <Lock class="mb-3 h-8 w-8 text-neutral-400" />
        <p class="mb-1 text-base font-semibold text-neutral-50">
          Точность по вопросам — функция Pro
        </p>
        <p class="mb-4 max-w-xs text-center text-sm text-neutral-400">
          Узнайте, на каких вопросах тестируемые ошибаются чаще всего.
          Доступно на тарифе Pro.
        </p>
        <Button
          variant="default"
          size="sm"
          @click="router.push('/billing')"
        >
          Перейти на Pro
        </Button>
      </div>
    </template>

    <!-- Pro owner: real accuracy bars -->
    <template v-else>
      <div
        v-for="row in accuracy"
        :key="row.question_id"
        class="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
      >
        <span class="text-sm text-neutral-300 sm:flex-1 sm:truncate">{{ row.body }}</span>
        <div class="flex items-center gap-3">
          <div class="flex-1 sm:w-40 sm:flex-none sm:shrink-0">
            <ProgressBar :value="row.accuracy_percent ?? 0" size="md" />
          </div>
          <span class="w-10 shrink-0 text-right text-sm font-semibold text-neutral-200">
            {{ formatPercent(row.accuracy_percent) }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
