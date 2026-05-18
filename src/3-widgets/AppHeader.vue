<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import Button from '@shared/ui/Button.vue'

const router = useRouter()
const authStore = useAuthStore()

async function handleLogout() {
  await authStore.logout()
  router.push('/')
}
</script>

<template>
  <header class="sticky top-0 z-40 h-14 border-b border-neutral-800 bg-neutral-900">
    <div class="mx-auto flex h-full max-w-7xl items-center gap-6 px-6">
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
