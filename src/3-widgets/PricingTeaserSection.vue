<script setup lang="ts">
// PricingTeaserSection — landing pricing screen. Reuses the same PricingCards
// feature component as the /billing page so the landing and the billing page
// stay visually identical. FSD: 3-widgets may compose 4-features slices.
import { onMounted } from 'vue'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import { usePaymentStore } from '@features/payment/model/usePaymentStore'
import PricingCards from '@features/payment/ui/PricingCards.vue'

const authStore = useAuthStore()
const store = usePaymentStore()

// Usage meters only make sense for an authenticated owner; a guest sees the
// plain plan cards. fetchUsage hits an auth-only RPC, so guard it.
onMounted(() => {
  if (authStore.user) void store.fetchUsage()
})
</script>

<template>
  <section class="flex min-h-dvh flex-col justify-center py-12">
    <div class="mx-auto w-full max-w-7xl px-6">
      <h2 class="text-xl font-semibold text-neutral-50">
        Тарифы
      </h2>
      <p class="mt-2 max-w-6xl text-sm leading-relaxed text-neutral-400">
        Quiz Flow можно использовать бесплатно — план Free подходит, чтобы создать
        первые тесты и попробовать AI-генерацию. План Pro снимает лимиты: безлимит
        тестов и вопросов, больше AI-генераций, индивидуальные ссылки доступа и
        статистика точности по вопросам.
      </p>

      <div class="mt-10">
        <PricingCards
          :usage="store.usage"
          :loading="store.loading"
        />
      </div>

      <!-- Plan details / FAQ -->
      <dl class="mt-12 space-y-6 border-t border-neutral-800 pt-8">
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
    </div>
  </section>
</template>
