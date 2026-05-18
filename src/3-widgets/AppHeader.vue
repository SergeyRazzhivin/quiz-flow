<script setup lang="ts">
import { watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Crown } from 'lucide-vue-next'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import { usePaymentStore } from '@features/payment/model/usePaymentStore'
import Button from '@shared/ui/Button.vue'

const router = useRouter()
const authStore = useAuthStore()
const paymentStore = usePaymentStore()

// Auth initialises asynchronously — load the usage snapshot once a user appears.
watch(
  () => authStore.user,
  (user) => {
    if (user && !paymentStore.usage) void paymentStore.fetchUsage()
  },
  { immediate: true },
)

async function handleLogout() {
  await authStore.logout()
  router.push('/')
}
</script>

<template>
  <header class="sticky top-0 z-40 h-14 border-b border-neutral-800 bg-neutral-900">
    <div class="mx-auto flex h-full max-w-6xl items-center gap-6 px-6">
      <RouterLink
        to="/"
        class="text-xl font-semibold text-orange-500"
      >
        Quiz Flow
      </RouterLink>

      <nav class="flex items-center gap-4">
        <RouterLink
          to="/"
          class="text-sm text-neutral-300 hover:text-neutral-50"
        >
          Все тесты
        </RouterLink>
        <RouterLink
          v-if="authStore.user"
          to="/my"
          class="text-sm text-neutral-300 hover:text-neutral-50"
        >
          Мои тесты
        </RouterLink>
        <RouterLink
          v-if="authStore.user"
          to="/billing"
          class="text-sm text-neutral-300 hover:text-neutral-50"
        >
          Тарифы
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-3">
        <template v-if="authStore.user">
          <!-- Current plan badge -->
          <RouterLink
            v-if="paymentStore.usage"
            to="/billing"
            class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-90"
            :class="paymentStore.isProActive
              ? 'bg-linear-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-600/30'
              : 'bg-neutral-800 text-neutral-300 ring-1 ring-neutral-700'"
          >
            <Crown
              v-if="paymentStore.isProActive"
              class="h-3.5 w-3.5"
            />
            {{ paymentStore.isProActive ? 'Pro' : 'Free' }}
          </RouterLink>

          <span class="max-w-[180px] truncate text-sm text-neutral-400">{{ authStore.user.email }}</span>
          <Button
            variant="ghost"
            size="sm"
            @click="handleLogout"
          >
            Выйти
          </Button>
        </template>
        <template v-else>
          <RouterLink to="/auth">
            <Button
              variant="outline"
              size="sm"
            >
              Войти
            </Button>
          </RouterLink>
        </template>
      </div>
    </div>
  </header>
</template>
