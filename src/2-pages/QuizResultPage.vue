<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'

const route = useRoute()
const store = useQuizTakingStore()

onMounted(async () => {
  // If arriving by direct URL (e.g. D-04 finished session on reload), result is not yet loaded.
  // If arriving via finishSession() navigation, result may already be partially set (no label).
  // Always call loadResult to ensure the full result including label is populated.
  if (!store.result?.label) {
    await store.loadResult(route.params.token as string)
  }
})

/**
 * D-18: Numeric score display.
 * Number.isInteger(score) → "3 из 5", not "3.0 из 5"
 * Fractional score → "2.5 из 5"
 */
function formatScore(score: number, total: number): string {
  const scoreStr = Number.isInteger(score) ? String(score) : score.toFixed(1)
  return `${scoreStr} из ${total}`
}
</script>

<template>
  <!-- No AppHeader — guest-only focused result screen (D-10, D-12) -->
  <div class="flex min-h-screen flex-col items-center justify-center px-4 py-12">
    <!-- Loading state while result is fetching -->
    <div
      v-if="!store.result && store.sessionStatus !== 'invalid'"
      class="text-sm text-neutral-400"
    >
      Загрузка результата...
    </div>

    <!-- Invalid / not found graceful state -->
    <div
      v-else-if="store.sessionStatus === 'invalid' && !store.result"
      class="rounded-2xl bg-neutral-900 p-8 text-center shadow-lg"
    >
      <p class="text-base text-neutral-400">
        Результат не найден или ссылка устарела.
      </p>
      <RouterLink
        to="/"
        class="mt-4 inline-block text-sm text-orange-500 hover:underline"
      >
        Перейти на Quiz Flow
      </RouterLink>
    </div>

    <!-- Result card (D-10, D-11, D-12, D-18) -->
    <div
      v-else-if="store.result"
      class="w-full max-w-md rounded-2xl bg-neutral-900 p-8 text-center shadow-lg"
    >
      <!-- Percentage: 28px prominent display (UI-SPEC section 5) -->
      <p class="text-[28px] font-semibold leading-tight text-neutral-50">
        {{ store.result.percentage }}%
      </p>

      <!-- Fraction line: "X из N" — D-18 numeric score display -->
      <p class="mt-1 text-xl text-neutral-400">
        {{ formatScore(store.result.score, store.result.totalQuestions) }}
      </p>

      <!-- Taker name label (D-10) -->
      <p
        v-if="store.result.label"
        class="mt-3 text-base text-neutral-400"
      >
        {{ store.result.label }}
      </p>

      <!-- Neutral completion message -->
      <p class="mt-6 text-base text-neutral-400">
        Тест завершён. Спасибо за участие.
      </p>

      <!-- D-12: Home link — soft service promo -->
      <RouterLink
        to="/"
        class="mt-6 inline-block text-sm text-orange-500 hover:underline"
      >
        Перейти на Quiz Flow
      </RouterLink>
    </div>
  </div>
</template>
