<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Check } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'

const freeFeatures = ['3 теста', '10 вопросов на тест', '10 AI-генераций в месяц']
const proFeatures = ['Неограниченно тестов и вопросов', '30 AI-генераций в месяц', 'Индивидуальные ссылки доступа']
</script>

<template>
  <section class="flex min-h-dvh flex-col justify-center bg-neutral-900/50 py-12">
    <div class="mx-auto max-w-6xl px-6">
      <h2 class="text-xl font-semibold text-neutral-50">
        Простые тарифы
      </h2>
      <p class="mt-2 text-sm text-neutral-400">
        Начни бесплатно — перейди на Pro когда нужно
      </p>
      <div class="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <!-- Free card -->
        <div class="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h3 class="text-xl font-semibold text-neutral-50">
            Free
          </h3>
          <p class="mt-3 text-2xl font-semibold text-neutral-50">
            0 ₽
          </p>
          <ul class="mb-6 mt-6 space-y-3">
            <li
              v-for="f in freeFeatures"
              :key="f"
              class="flex items-start gap-2 text-sm text-neutral-300"
            >
              <Check class="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              {{ f }}
            </li>
          </ul>
        </div>
        <!-- Pro card -->
        <div class="flex flex-col rounded-2xl border border-violet-600/40 bg-neutral-900 p-6 ring-1 ring-violet-600/20">
          <div class="flex items-center gap-2">
            <h3 class="text-xl font-semibold text-neutral-50">
              Pro
            </h3>
            <span class="rounded-full bg-linear-to-r from-violet-600 to-indigo-600 px-2 py-0.5 text-xs text-white">
              PRO
            </span>
          </div>
          <p class="mt-3">
            <span class="text-2xl font-semibold text-neutral-50">490 ₽</span><span class="text-sm text-neutral-400">/мес</span>
          </p>
          <ul class="mb-6 mt-6 space-y-3">
            <li
              v-for="f in proFeatures"
              :key="f"
              class="flex items-start gap-2 text-sm text-neutral-300"
            >
              <Check class="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
              {{ f }}
            </li>
          </ul>
          <RouterLink to="/billing">
            <Button
              variant="outline"
              class="mt-4 w-full cursor-pointer"
            >
              Подробнее о Pro
            </Button>
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>
