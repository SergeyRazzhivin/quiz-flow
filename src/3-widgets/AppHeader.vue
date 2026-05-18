<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { Crown, Menu, X } from 'lucide-vue-next'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import { usePaymentStore } from '@features/payment/model/usePaymentStore'
import Button from '@shared/ui/Button.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const paymentStore = usePaymentStore()

const mobileMenuOpen = ref(false)

// Auth initialises asynchronously — load the usage snapshot once a user appears.
watch(
  () => authStore.user,
  (user) => {
    if (user && !paymentStore.usage) void paymentStore.fetchUsage()
  },
  { immediate: true },
)

// Collapse the mobile panel whenever the route changes.
watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false
  },
)

async function handleLogout() {
  mobileMenuOpen.value = false
  await authStore.logout()
  router.push('/')
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-900">
    <div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
      <RouterLink
        to="/"
        class="text-xl font-semibold text-orange-500"
      >
        Quiz Flow
      </RouterLink>

      <!-- Desktop nav -->
      <nav class="hidden items-center gap-4 md:flex">
        <RouterLink
          to="/quizzes"
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

      <!-- Desktop user cluster -->
      <div class="ml-auto hidden items-center gap-3 md:flex">
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

      <!-- Mobile hamburger toggle -->
      <button
        type="button"
        class="ml-auto inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50 md:hidden"
        :aria-label="mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <X
          v-if="mobileMenuOpen"
          class="h-5 w-5"
        />
        <Menu
          v-else
          class="h-5 w-5"
        />
      </button>
    </div>

    <!-- Mobile menu panel -->
    <div
      v-if="mobileMenuOpen"
      class="border-t border-neutral-800 bg-neutral-900 px-6 py-4 md:hidden"
    >
      <nav class="flex flex-col gap-1">
        <RouterLink
          to="/quizzes"
          class="cursor-pointer rounded-lg px-2 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50"
        >
          Все тесты
        </RouterLink>
        <RouterLink
          v-if="authStore.user"
          to="/my"
          class="cursor-pointer rounded-lg px-2 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50"
        >
          Мои тесты
        </RouterLink>
        <RouterLink
          v-if="authStore.user"
          to="/billing"
          class="cursor-pointer rounded-lg px-2 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50"
        >
          Тарифы
        </RouterLink>
      </nav>

      <div class="mt-3 border-t border-neutral-800 pt-3">
        <template v-if="authStore.user">
          <div class="flex items-center gap-3 px-2">
            <RouterLink
              v-if="paymentStore.usage"
              to="/billing"
              class="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-90"
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
            <span class="truncate text-sm text-neutral-400">{{ authStore.user.email }}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            class="mt-3 w-full"
            @click="handleLogout"
          >
            Выйти
          </Button>
        </template>
        <template v-else>
          <RouterLink
            to="/auth"
            class="block"
          >
            <Button
              variant="outline"
              size="sm"
              class="w-full"
            >
              Войти
            </Button>
          </RouterLink>
        </template>
      </div>
    </div>
  </header>
</template>
