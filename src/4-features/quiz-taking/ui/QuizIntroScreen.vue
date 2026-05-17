<script setup lang="ts">
import { computed } from 'vue'
import { formatDuration } from '@shared/lib/format'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'
import GuestLoginForm from './GuestLoginForm.vue'

const store = useQuizTakingStore()

// Meta row: "N вопросов · M мин" (time shown only when set).
// Uses store.questionCount so it is correct both pre-login (get-quiz-meta, D-01)
// and post-login (synced from the loaded question list).
const metaText = computed(() => {
  const q = store.questionCount
  const questionLabel = q === 1 ? '1 вопрос' : `${q} вопросов`
  if (store.quiz?.time_limit_sec) {
    return `${questionLabel} · ${formatDuration(store.quiz.time_limit_sec)}`
  }
  return questionLabel
})
</script>

<template>
  <!-- Full-page centered layout — no AppHeader on guest screens -->
  <div class="flex min-h-screen flex-col items-center justify-center px-4 py-12">
    <div class="w-full max-w-md rounded-2xl bg-neutral-900 p-8 shadow-lg">

      <!-- 1. Cover image (conditional) -->
      <img
        v-if="store.quiz?.cover_url"
        :src="store.quiz.cover_url"
        :alt="store.quiz?.title ?? 'Обложка теста'"
        class="mb-6 w-full rounded-xl object-cover"
        style="aspect-ratio: 16/9;"
      />

      <!-- 2. Quiz title -->
      <p class="mb-2 text-xl font-semibold text-neutral-50">
        {{ store.quiz?.title ?? '' }}
      </p>

      <!-- 3. Meta row: question count · duration -->
      <p class="text-sm text-neutral-400">
        {{ metaText }}
      </p>

      <!-- 4. Description (conditional, line-clamped) -->
      <p
        v-if="store.quiz?.description"
        class="mb-6 mt-2 line-clamp-3 text-base text-neutral-400"
      >
        {{ store.quiz.description }}
      </p>

      <!-- 5. Divider -->
      <div class="mb-6 mt-4 border-t border-neutral-800" />

      <!-- 6. Login form — the quiz starts immediately on a successful login (D-01;
           supersedes D-02 — no intermediate "Начать" screen). -->
      <GuestLoginForm />

    </div>
  </div>
</template>
