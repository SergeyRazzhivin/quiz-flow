<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { fetchCarouselQuizzes } from '@entities/quiz/api'
import type { Quiz } from '@entities/quiz/model'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import QuizCard from '@entities/quiz/ui/QuizCard.vue'
import Button from '@shared/ui/Button.vue'

const authStore = useAuthStore()

const quizzes = ref<Quiz[]>([])
const isLoading = ref(true)
const error = ref(false)

const CARD_WIDTH = 256 // w-64
const GAP = 16 // gap-4

const currentIndex = ref(0)

function getVisibleCount(): number {
  if (typeof window === 'undefined') return 4
  if (window.innerWidth >= 1024) return 4
  if (window.innerWidth >= 768) return 3
  return 1
}

const visibleCount = ref(getVisibleCount())

const maxIndex = computed(() => Math.max(0, quizzes.value.length - visibleCount.value))

const trackStyle = computed(() => ({
  transform: `translateX(-${currentIndex.value * (CARD_WIDTH + GAP)}px)`,
}))

function prev() {
  if (currentIndex.value > 0) currentIndex.value--
}
function next() {
  if (currentIndex.value < maxIndex.value) currentIndex.value++
}

let timer: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (timer) return
  timer = setInterval(() => {
    if (currentIndex.value >= maxIndex.value) {
      currentIndex.value = 0
    } else {
      currentIndex.value++
    }
  }, 4000)
}
function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// Named handler reference so removeEventListener can detach it (RESEARCH Pitfall 3)
function handleResize() {
  visibleCount.value = getVisibleCount()
}

onMounted(async () => {
  try {
    quizzes.value = await fetchCarouselQuizzes(12)
  } catch {
    error.value = true
  } finally {
    isLoading.value = false
  }
  visibleCount.value = getVisibleCount()
  window.addEventListener('resize', handleResize)
  startTimer()
})

onUnmounted(() => {
  stopTimer()
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <section class="flex min-h-dvh flex-col justify-center py-12">
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

      <!-- Loading skeletons -->
      <div
        v-if="isLoading"
        class="flex gap-4 overflow-hidden"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-52 w-64 shrink-0 animate-pulse rounded-2xl bg-neutral-800"
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

      <!-- Carousel -->
      <div
        v-else
        class="relative overflow-hidden"
        @mouseenter="stopTimer"
        @mouseleave="startTimer"
      >
        <!-- Track -->
        <div
          class="flex gap-4 transition-transform duration-300 ease-in-out"
          :style="trackStyle"
        >
          <QuizCard
            v-for="quiz in quizzes"
            :key="quiz.id"
            :quiz="quiz"
            class="w-64 shrink-0"
          />
        </div>

        <!-- Prev arrow -->
        <button
          type="button"
          aria-label="Предыдущий"
          :class="[
            'absolute left-0 top-1/2 -translate-y-1/2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-50',
            currentIndex === 0 ? 'pointer-events-none opacity-40' : '',
          ]"
          @click="prev"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>

        <!-- Next arrow -->
        <button
          type="button"
          aria-label="Следующий"
          :class="[
            'absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-50',
            currentIndex >= maxIndex ? 'pointer-events-none opacity-40' : '',
          ]"
          @click="next"
        >
          <ChevronRight class="h-5 w-5" />
        </button>
      </div>
    </div>
  </section>
</template>
