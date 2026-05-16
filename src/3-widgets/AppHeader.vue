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
  <header class="sticky top-0 z-40 h-14 border-b border-gray-200 bg-white">
    <div class="mx-auto flex h-full max-w-7xl items-center gap-6 px-6">
      <RouterLink
        to="/"
        class="text-xl font-semibold text-violet-600"
      >
        Quiz Flow
      </RouterLink>

      <nav class="flex items-center gap-4">
        <RouterLink
          to="/"
          class="text-sm text-gray-600 hover:text-gray-900"
        >
          Все тесты
        </RouterLink>
        <RouterLink
          v-if="authStore.user"
          to="/my"
          class="text-sm text-gray-600 hover:text-gray-900"
        >
          Мои тесты
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-3">
        <template v-if="authStore.user">
          <span class="max-w-[180px] truncate text-sm text-gray-500">{{ authStore.user.email }}</span>
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
