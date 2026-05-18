<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import Button from '@shared/ui/Button.vue'

const authStore = useAuthStore()
</script>

<template>
  <section class="py-16 text-center md:py-20">
    <div class="mx-auto max-w-3xl px-6">
      <h1 class="text-4xl font-semibold leading-[1.15] text-neutral-50 md:text-5xl">
        Создавай тесты с AI за секунды
      </h1>
      <p class="mt-4 text-base leading-relaxed text-neutral-400">
        Загрузи текст — нейросеть сгенерирует готовый тест. Сразу отправляй участникам и смотри результаты.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <!-- Primary CTA — unauthenticated -->
        <RouterLink
          v-if="!authStore.user"
          to="/auth"
        >
          <button
            type="button"
            class="h-10 cursor-pointer rounded-lg bg-linear-to-r from-violet-600 to-indigo-600 px-8 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Начать бесплатно
          </button>
        </RouterLink>
        <!-- Primary CTA — authenticated -->
        <RouterLink
          v-else
          to="/my"
        >
          <Button variant="default">Мои тесты</Button>
        </RouterLink>
        <!-- Secondary CTA — both states -->
        <RouterLink to="/quizzes">
          <Button variant="outline">Смотреть тесты</Button>
        </RouterLink>
      </div>
    </div>
  </section>
</template>
