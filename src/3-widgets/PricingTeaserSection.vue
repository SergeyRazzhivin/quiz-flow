<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Check } from 'lucide-vue-next'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import Button from '@shared/ui/Button.vue'

const authStore = useAuthStore()

const freeFeatures = [
  'До 3 тестов',
  'До 10 вопросов в тесте',
  '10 AI-генераций в месяц',
  'Прохождение по ссылке и базовая статистика',
]
const proFeatures = [
  'Неограниченно тестов и вопросов',
  '30 AI-генераций в месяц',
  'Индивидуальные ссылки доступа для участников',
  'Расширенная статистика по каждому вопросу',
]

const details = [
  {
    title: 'Без карты на старте',
    body: 'Регистрация и бесплатный тариф не требуют привязки карты — начни создавать тесты сразу.',
  },
  {
    title: 'Оплата в рублях',
    body: 'Подписка Pro оплачивается российскими картами через ЮKassa, чек приходит автоматически.',
  },
  {
    title: 'Отмена в один клик',
    body: 'Откажись от Pro когда угодно — доступ сохранится до конца оплаченного месяца.',
  },
]
</script>

<template>
  <section class="flex min-h-dvh flex-col justify-center py-12">
    <div class="mx-auto max-w-6xl px-6">
      <h2 class="text-xl font-semibold text-neutral-50">
        Простые тарифы
      </h2>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
        Начни бесплатно и создавай тесты без ограничений по времени — бесплатный
        тариф не пробный, им можно пользоваться постоянно. Когда тестов и участников
        станет больше, перейди на Pro: снимаются лимиты на количество тестов и вопросов,
        растёт месячная квота AI-генераций и открывается расширенная статистика.
        Оплата помесячно, без скрытых платежей — отменить подписку можно в любой момент,
        и Pro-возможности останутся доступны до конца оплаченного периода.
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
          <p class="mt-1 text-sm text-neutral-400">
            Чтобы попробовать и собрать первые тесты
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
          <RouterLink
            v-if="!authStore.user"
            to="/auth"
            class="mt-auto"
          >
            <Button
              variant="outline"
              class="w-full cursor-pointer"
            >
              Начать бесплатно
            </Button>
          </RouterLink>
        </div>
        <!-- Pro card -->
        <div class="flex flex-col rounded-2xl border border-violet-600/40 bg-neutral-900 p-6 ring-1 ring-violet-600/20">
          <div class="flex items-center gap-2">
            <h3 class="text-xl font-semibold text-neutral-50">
              Pro
            </h3>
            <span class="rounded-full bg-linear-to-r from-violet-600 to-indigo-600 px-2 py-0.5 text-xs text-white">
              Популярный
            </span>
          </div>
          <p class="mt-3">
            <span class="text-2xl font-semibold text-neutral-50">490 ₽</span><span class="text-sm text-neutral-400">/мес</span>
          </p>
          <p class="mt-1 text-sm text-neutral-400">
            Для регулярной работы с тестами и группами
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
          <RouterLink
            to="/billing"
            class="mt-auto"
          >
            <Button
              variant="outline"
              class="w-full cursor-pointer"
            >
              Подробнее о Pro
            </Button>
          </RouterLink>
        </div>
      </div>
      <!-- Details / reassurance -->
      <div class="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
        <div
          v-for="detail in details"
          :key="detail.title"
          class="text-left"
        >
          <h3 class="mb-1 text-sm font-semibold text-neutral-200">
            {{ detail.title }}
          </h3>
          <p class="text-sm leading-relaxed text-neutral-400">
            {{ detail.body }}
          </p>
        </div>
      </div>

      <p class="mt-10 text-center text-sm text-neutral-500">
        Лимиты бесплатного тарифа обновляются каждый месяц, а апгрейд на Pro
        вступает в силу сразу после оплаты. Полное сравнение возможностей и оплата —
        на странице
        <RouterLink
          to="/billing"
          class="cursor-pointer text-orange-400 underline-offset-2 hover:text-orange-300 hover:underline"
        >
          тарифов
        </RouterLink>.
      </p>
    </div>
  </section>
</template>
