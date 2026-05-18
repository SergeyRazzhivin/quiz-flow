<script setup lang="ts">
// LatestQuizzes — landing block showing the four most recently updated
// published quizzes in a simple grid. FSD: 3-widgets.
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchCarouselQuizzes } from '@entities/quiz/api'
import type { Quiz } from '@entities/quiz/model'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import QuizCard from '@entities/quiz/ui/QuizCard.vue'
import Button from '@shared/ui/Button.vue'

const authStore = useAuthStore()

const quizzes = ref<Quiz[]>([])
const isLoading = ref(true)
const error = ref(false)

onMounted(async () => {
  try {
    quizzes.value = await fetchCarouselQuizzes(4)
  } catch {
    error.value = true
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <section class="py-8">
    <div class="mx-auto max-w-6xl px-6">
      <!-- Section header row -->
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h2 class="text-xl font-semibold text-neutral-50">
            Свежие тесты
          </h2>
          <p class="text-sm text-neutral-400">
            Последние публикации · обновлено недавно
          </p>
        </div>
        <RouterLink
          to="/quizzes"
          class="text-sm text-orange-400 underline-offset-2 hover:text-orange-300 hover:underline"
        >
          Смотреть все
        </RouterLink>
      </div>

      <p class="mb-6 max-w-2xl text-sm leading-relaxed text-neutral-400">
        Загляни в тесты, которые недавно создали и обновили другие авторы — это
        живой пример того, что можно собрать в Quiz Flow за пару минут.
      </p>

      <!-- Loading skeletons -->
      <div
        v-if="isLoading"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-52 animate-pulse rounded-2xl bg-neutral-800"
        />
      </div>

      <!-- Error state -->
      <p
        v-else-if="error"
        class="text-sm text-neutral-400"
      >
        Не удалось загрузить тесты. Попробуй обновить страницу.
      </p>

      <!-- Empty state -->
      <div
        v-else-if="quizzes.length === 0"
        class="py-12 text-center"
      >
        <p class="text-sm font-semibold text-neutral-300">
          Тестов пока нет
        </p>
        <p class="mt-2 text-sm text-neutral-500">
          Опубликованные тесты появятся здесь. Создай первый — это займёт минуту.
        </p>
        <RouterLink
          v-if="authStore.user"
          to="/editor/new"
        >
          <Button class="mt-6">
            Создать тест
          </Button>
        </RouterLink>
        <RouterLink
          v-else
          to="/auth"
        >
          <Button class="mt-6">
            Начать бесплатно
          </Button>
        </RouterLink>
      </div>

      <!-- Quiz grid -->
      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <QuizCard
          v-for="quiz in quizzes"
          :key="quiz.id"
          :quiz="quiz"
        />
      </div>
    </div>
  </section>
</template>
