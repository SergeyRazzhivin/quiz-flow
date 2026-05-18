<script setup lang="ts">
import { useRouter } from 'vue-router'
import { BarChart3, Clock, FilePen, FileQuestion, Globe, Image, Pencil, Trash2 } from 'lucide-vue-next'
import type { Quiz } from '../model'
import { formatDuration } from '@shared/lib/format'
import Tooltip from '@shared/ui/Tooltip.vue'

defineProps<{
  quiz: Quiz
  showActions?: boolean
}>()

const emit = defineEmits<{
  delete: [quiz: Quiz]
}>()

const router = useRouter()
</script>

<template>
  <div
    class="group flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 transition-colors duration-150 hover:border-orange-500/50"
  >
    <div class="relative h-32 shrink-0 overflow-hidden bg-neutral-800">
      <img
        v-if="quiz.cover_url"
        :src="quiz.cover_url"
        :alt="quiz.title"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      >
      <div
        v-else
        class="flex h-full items-center justify-center bg-linear-to-br from-neutral-800 to-neutral-900"
      >
        <Image class="h-7 w-7 text-neutral-600" />
      </div>
      <span
        v-if="showActions"
        class="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 text-[11px] font-medium shadow-sm ring-1 backdrop-blur-md"
        :class="quiz.is_published
          ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
          : 'bg-neutral-950/70 text-neutral-300 ring-neutral-700'"
      >
        <Globe
          v-if="quiz.is_published"
          class="h-3 w-3"
        />
        <FilePen
          v-else
          class="h-3 w-3"
        />
        {{ quiz.is_published ? 'Опубликован' : 'Черновик' }}
      </span>
    </div>

    <div class="flex flex-1 flex-col p-3.5">
      <h3 class="line-clamp-1 text-sm font-semibold text-neutral-50">
        {{ quiz.title }}
      </h3>
      <p
        class="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-neutral-400"
      >
        {{ quiz.description || 'Без описания' }}
      </p>

      <!-- Meta chips -->
      <div class="mt-2.5 mb-3 flex flex-wrap items-center gap-1.5">
        <span
          v-if="quiz.question_count != null"
          class="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-1.5 py-0.5 text-[11px] font-medium text-neutral-300"
        >
          <FileQuestion class="h-3 w-3 text-neutral-500" />
          {{ quiz.question_count }}
          {{ quiz.question_count === 1 ? 'вопрос' : quiz.question_count >= 2 && quiz.question_count <= 4 ? 'вопроса' : 'вопросов' }}
        </span>
        <span
          v-if="quiz.time_limit_sec"
          class="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-1.5 py-0.5 text-[11px] font-medium text-neutral-300"
        >
          <Clock class="h-3 w-3 text-neutral-500" />
          {{ formatDuration(quiz.time_limit_sec) }}
        </span>
      </div>

      <div
        v-if="showActions"
        class="mt-auto flex items-center gap-1.5 border-t border-neutral-800 pt-3"
      >
        <button
          type="button"
          aria-label="Изменить тест"
          class="flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-orange-500/10 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500 hover:text-white"
          @click="router.push('/editor/' + quiz.id)"
        >
          <Pencil class="h-3.5 w-3.5" />
          Изменить
        </button>
        <Tooltip content="Статистика">
          <button
            type="button"
            aria-label="Статистика теста"
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-100"
            @click="router.push(`/quiz/${quiz.id}/stats`)"
          >
            <BarChart3 class="h-4 w-4" />
          </button>
        </Tooltip>
        <Tooltip content="Удалить тест">
          <button
            type="button"
            aria-label="Удалить тест"
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
            @click="emit('delete', quiz)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</template>
