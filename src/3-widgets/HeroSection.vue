<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Sparkles, Zap, FileText, Share2 } from 'lucide-vue-next'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import Button from '@shared/ui/Button.vue'

const authStore = useAuthStore()

const highlights = [
  {
    icon: Zap,
    title: 'Тест за секунды',
    body: 'Не трать часы на составление вопросов вручную — AI делает черновик мгновенно.',
  },
  {
    icon: FileText,
    title: 'Любой источник',
    body: 'Вставь текст или загрузи PDF либо DOCX — нейросеть разберёт материал сама.',
  },
  {
    icon: Share2,
    title: 'Готов к отправке',
    body: 'Получи ссылку для участников и собирай результаты сразу после публикации.',
  },
]
</script>

<template>
  <section class="flex min-h-dvh flex-col justify-center py-16 text-center">
    <div class="mx-auto max-w-3xl px-6">
      <span class="mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-sm text-neutral-300">
        <Sparkles class="h-4 w-4 text-orange-400" />
        Генерация тестов на AI
      </span>
      <h1 class="text-4xl font-semibold leading-[1.15] text-neutral-50 md:text-5xl">
        Создавай тесты с AI за секунды
      </h1>
      <p class="mt-4 text-base leading-relaxed text-neutral-400">
        Загрузи текст — нейросеть сгенерирует готовый тест с вопросами и вариантами ответов.
        Отправляй участникам ссылку и смотри результаты в реальном времени, без ручной проверки.
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
      <p class="mt-4 text-sm text-neutral-500">
        Бесплатно — 3 теста и 10 AI-генераций в месяц. Карта не нужна.
      </p>

      <!-- Feature highlights -->
      <div class="mt-14 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
        <div
          v-for="item in highlights"
          :key="item.title"
          class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
        >
          <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800 text-orange-400">
            <component
              :is="item.icon"
              class="h-5 w-5"
            />
          </div>
          <h3 class="mb-2 text-base font-semibold text-neutral-50">
            {{ item.title }}
          </h3>
          <p class="text-sm leading-relaxed text-neutral-400">
            {{ item.body }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
