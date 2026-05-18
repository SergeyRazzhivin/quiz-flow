<script setup lang="ts">
// AppFooter — thin global footer with copyright and a couple of links.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const year = computed(() => new Date().getFullYear())
</script>

<template>
  <footer class="border-t border-neutral-800 bg-neutral-900">
    <div
      class="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-5 text-xs text-neutral-500 sm:flex-row sm:justify-between"
    >
      <p>
        © {{ year }} Quiz Flow — сервис для создания и прохождения тестов.
      </p>
      <nav class="flex items-center gap-4">
        <RouterLink
          to="/quizzes"
          class="transition-colors hover:text-neutral-300"
        >
          Все тесты
        </RouterLink>
        <RouterLink
          to="/billing"
          class="transition-colors hover:text-neutral-300"
        >
          Тарифы
        </RouterLink>
      </nav>
    </div>
  </footer>
</template>
