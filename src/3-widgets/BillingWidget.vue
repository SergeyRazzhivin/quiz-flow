<script setup lang="ts">
// BillingWidget — the /billing page shell. Composes the `payment` feature
// slice (PricingCards + ProStatusBanner) inside the standard app shell.
// FSD: 3-widgets — the only layer allowed to compose feature slices.
import { onMounted } from 'vue'
import { usePaymentStore } from '@features/payment/model/usePaymentStore'
import PricingCards from '@features/payment/ui/PricingCards.vue'
import ProStatusBanner from '@features/payment/ui/ProStatusBanner.vue'
import AppHeader from './AppHeader.vue'

const store = usePaymentStore()

// Pitfall 6: refresh usage on mount so the page reflects an updated plan after
// the YooKassa return_url round-trip.
onMounted(() => {
  void store.fetchUsage()
})
</script>

<template>
  <div class="min-h-[100dvh]">
    <AppHeader />

    <main class="mx-auto max-w-6xl px-6 py-16">
      <h1 class="text-2xl font-semibold text-neutral-50">Тарифы</h1>
      <p class="mt-2 max-w-6xl text-sm leading-relaxed text-neutral-400">
        Quiz Flow можно использовать бесплатно — план Free подходит, чтобы создать
        первые тесты и попробовать AI-генерацию. План Pro снимает лимиты: безлимит
        тестов и вопросов, больше AI-генераций, индивидуальные ссылки доступа и
        статистика точности по вопросам.
      </p>

      <!-- Loading branch -->
      <template v-if="store.loading && !store.usage">
        <div class="mt-10 h-10 w-48 animate-pulse rounded-lg bg-neutral-800" />
        <div class="mt-8 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
          <div class="h-96 animate-pulse rounded-xl bg-neutral-800" />
          <div class="h-96 animate-pulse rounded-xl bg-neutral-800" />
        </div>
      </template>

      <!-- Error branch -->
      <div
        v-else-if="store.error"
        class="mt-10 max-w-3xl rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-12 text-center"
      >
        <h2 class="text-xl font-semibold text-neutral-50">Не удалось загрузить данные тарифа</h2>
        <p class="mt-2 text-sm text-neutral-400">
          Проверьте подключение и попробуйте обновить страницу.
        </p>
      </div>

      <!-- Data branch -->
      <template v-else>
        <ProStatusBanner
          v-if="store.isProActive"
          :usage="store.usage"
          class="mt-10 mb-8 max-w-6xl"
        />
        <div class="mt-10 max-w-3xl">
          <PricingCards
            :usage="store.usage"
            :loading="store.loading"
          />
        </div>

        <!-- Plan details / FAQ -->
        <dl class="mt-12 max-w-xl space-y-6 border-t border-neutral-800 pt-8">
          <div>
            <dt class="text-sm font-medium text-neutral-200">Как проходит оплата</dt>
            <dd class="mt-1 text-sm leading-relaxed text-neutral-400">
              Оплата картой через YooKassa в рублях. После успешного платежа
              доступ к Pro открывается автоматически — возвращаться и что-то
              активировать вручную не нужно.
            </dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-neutral-200">Это разовый платёж, а не подписка</dt>
            <dd class="mt-1 text-sm leading-relaxed text-neutral-400">
              Pro оплачивается за период (месяц или год) и не продлевается
              автоматически — деньги не спишутся повторно. Когда период
              заканчивается, аккаунт возвращается на план Free. Кнопка
              «Продлить» доступна в любой момент.
            </dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-neutral-200">Что будет с тестами после окончания Pro</dt>
            <dd class="mt-1 text-sm leading-relaxed text-neutral-400">
              Все созданные тесты сохраняются, и их можно открывать и
              редактировать. Ограничения Free снова применяются только к
              новым тестам и вопросам — данные не удаляются.
            </dd>
          </div>
        </dl>
      </template>
    </main>
  </div>
</template>
