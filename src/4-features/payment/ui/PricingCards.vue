<script setup lang="ts">
// PricingCards — Free + Pro plan cards with a monthly/yearly period toggle.
// Props-driven display; the only side effect is the createPayment store call.
// FSD: 4-features/payment.
import { ref, computed } from 'vue'
import { Check } from 'lucide-vue-next'
import { usePaymentStore, type UsageData, type BillingPeriod } from '../model/usePaymentStore'

const props = defineProps<{
  usage: UsageData | null
  loading: boolean
}>()

const store = usePaymentStore()

const selectedPeriod = ref<BillingPeriod>('monthly')

const isFreeUser = computed(() => !props.usage || props.usage.plan === 'free')

const proPrice = computed(() => (selectedPeriod.value === 'monthly' ? '490 ₽' : '4 490 ₽'))
const proUnit = computed(() => (selectedPeriod.value === 'monthly' ? '/мес' : '/год'))

// Free-card usage meters — shown only when usage is loaded and plan is free.
const showMeters = computed(() => !props.loading && props.usage?.plan === 'free')
const quizMeter = computed(() =>
  props.usage ? `${props.usage.quizzes_used} из ${props.usage.quizzes_limit ?? 3} тестов` : '',
)
const aiMeter = computed(() =>
  props.usage ? `${props.usage.ai_used} из ${props.usage.ai_limit} AI-генераций в этом периоде` : '',
)

interface Feature {
  label: string
  meter?: 'quiz' | 'ai'
  disabled?: boolean
}

const freeFeatures: Feature[] = [
  { label: '3 теста', meter: 'quiz' },
  { label: '10 вопросов на тест' },
  { label: '10 AI-генераций в месяц', meter: 'ai' },
  { label: 'Публичный доступ к тестам' },
  { label: 'Индивидуальные ссылки', disabled: true },
  { label: 'Статистика по вопросам', disabled: true },
]

const proFeatures: string[] = [
  'Неограниченно тестов',
  'Неограниченно вопросов',
  '30 AI-генераций в месяц',
  'Публичный доступ к тестам',
  'Индивидуальные ссылки доступа',
  'Статистика точности по вопросам',
]

function handleSubscribe(): void {
  void store.createPayment(selectedPeriod.value)
}
</script>

<template>
  <div>
    <!-- Period toggle -->
    <div class="mb-8 flex justify-center">
      <div class="inline-flex items-center gap-1 rounded-lg bg-neutral-900 p-1">
        <button
          type="button"
          class="h-9 cursor-pointer rounded-md px-4 text-sm transition-colors"
          :class="selectedPeriod === 'monthly' ? 'bg-neutral-700 text-neutral-50' : 'text-neutral-400 hover:text-neutral-200'"
          @click="selectedPeriod = 'monthly'"
        >
          Помесячно
        </button>
        <button
          type="button"
          class="flex h-9 cursor-pointer items-center gap-2 rounded-md px-4 text-sm transition-colors"
          :class="selectedPeriod === 'yearly' ? 'bg-neutral-700 text-neutral-50' : 'text-neutral-400 hover:text-neutral-200'"
          @click="selectedPeriod = 'yearly'"
        >
          Ежегодно
          <span class="rounded-full bg-violet-600/20 px-2 py-0.5 text-xs text-violet-400">
            Скидка 24%
          </span>
        </button>
      </div>
    </div>

    <!-- Plan cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
      <!-- Free card -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h3 class="text-xl font-semibold text-neutral-50">Free</h3>
        <p class="mt-3">
          <span class="text-2xl font-semibold text-neutral-50">0 ₽</span>
        </p>
        <ul class="mt-6 space-y-3">
          <li
            v-for="f in freeFeatures"
            :key="f.label"
            class="text-sm"
          >
            <div class="flex items-start gap-2">
              <Check class="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              <span :class="f.disabled ? 'text-neutral-500 line-through' : 'text-neutral-300'">
                {{ f.label }}
              </span>
            </div>
            <p
              v-if="showMeters && f.meter === 'quiz'"
              class="ml-6 mt-0.5 text-xs text-neutral-400"
            >
              {{ quizMeter }}
            </p>
            <p
              v-if="showMeters && f.meter === 'ai'"
              class="ml-6 mt-0.5 text-xs text-neutral-400"
            >
              {{ aiMeter }}
            </p>
          </li>
        </ul>
        <button
          type="button"
          disabled
          class="mt-6 h-10 w-full rounded-md bg-neutral-800 text-sm font-medium text-neutral-400 disabled:opacity-60"
        >
          {{ isFreeUser ? 'Текущий план' : 'Free' }}
        </button>
      </div>

      <!-- Pro card -->
      <div class="rounded-xl border border-violet-600/60 bg-neutral-900 p-6 ring-1 ring-violet-600/10">
        <div class="flex items-center gap-2">
          <h3 class="text-xl font-semibold text-neutral-50">Pro</h3>
          <span class="rounded-full bg-linear-to-r from-violet-600 to-indigo-600 px-2 py-0.5 text-xs text-white">
            PRO
          </span>
        </div>
        <p class="mt-3">
          <span class="text-2xl font-semibold text-neutral-50">{{ proPrice }}</span>
          <span class="text-sm text-neutral-400">{{ proUnit }}</span>
        </p>
        <ul class="mt-6 space-y-3">
          <li
            v-for="label in proFeatures"
            :key="label"
            class="flex items-start gap-2 text-sm text-neutral-300"
          >
            <Check class="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
            <span>{{ label }}</span>
          </li>
        </ul>
        <button
          type="button"
          :disabled="loading"
          class="mt-6 h-10 w-full cursor-pointer rounded-md bg-linear-to-r from-violet-600 to-indigo-600 px-8 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          @click="handleSubscribe"
        >
          {{ loading ? 'Переходим к оплате…' : 'Подписаться' }}
        </button>
      </div>
    </div>
  </div>
</template>
