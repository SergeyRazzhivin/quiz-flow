<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ClipboardX, LinkIcon } from 'lucide-vue-next'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'
import QuizIntroScreen from '@features/quiz-taking/ui/QuizIntroScreen.vue'
import GracefulState from '@features/quiz-taking/ui/GracefulState.vue'

const route = useRoute()
const store = useQuizTakingStore()

onMounted(() => {
  const token = route.params.token as string
  void store.init(token)
})

onUnmounted(() => {
  store.cleanup()
})
</script>

<template>
  <!-- idle → intro+login on one screen (D-01) -->
  <QuizIntroScreen
    v-if="store.sessionStatus === 'idle' || store.sessionStatus === 'intro'"
  />

  <!-- not_ready → quiz has zero questions (D-19) -->
  <GracefulState
    v-else-if="store.sessionStatus === 'not_ready'"
    :icon="ClipboardX"
    heading="Тест пока не готов"
    body="Автор ещё не добавил вопросы. Попробуйте зайти позже."
  />

  <!-- invalid → expired or bad token -->
  <GracefulState
    v-else-if="store.sessionStatus === 'invalid'"
    :icon="LinkIcon"
    heading="Ссылка недействительна"
    body="Ссылка устарела или была отозвана. Обратитесь к автору теста."
  />

  <!-- active → placeholder; full QuestionTaker UI added in 02-04 -->
  <div
    v-else-if="store.sessionStatus === 'active'"
    class="flex min-h-screen flex-col items-center justify-center px-4 py-12"
  >
    <div class="w-full max-w-md rounded-2xl bg-neutral-900 p-8 text-center shadow-lg">
      <p class="text-xl font-semibold text-neutral-50">Тест начат</p>
      <p class="mt-2 text-base text-neutral-400">
        Интерфейс вопросов будет доступен в следующем обновлении.
      </p>
    </div>
  </div>
</template>
