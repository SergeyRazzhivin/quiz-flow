<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Image, Pencil, Trash2 } from 'lucide-vue-next'
import type { Quiz } from '../model'
import { formatDuration } from '@shared/lib/format'
import Button from '@shared/ui/Button.vue'

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
    class="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 transition duration-150 hover:border-orange-500/50 hover:shadow-[0_0_18px_-2px_rgba(249,115,22,0.25)]"
  >
    <div class="relative aspect-video bg-neutral-800">
      <img
        v-if="quiz.cover_url"
        :src="quiz.cover_url"
        :alt="quiz.title"
        class="h-full w-full object-cover"
      >
      <div
        v-else
        class="flex h-full items-center justify-center"
      >
        <Image class="h-7 w-7 text-neutral-600" />
      </div>
      <span
        v-if="showActions"
        class="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm"
        :class="quiz.is_published ? 'bg-orange-500/90 text-white' : 'bg-neutral-950/80 text-white'"
      >
        {{ quiz.is_published ? 'Опубликован' : 'Черновик' }}
      </span>
    </div>

    <div class="flex flex-1 flex-col p-3">
      <h3 class="line-clamp-1 text-sm font-semibold text-neutral-50">
        {{ quiz.title }}
      </h3>
      <p
        v-if="quiz.description"
        class="mt-0.5 line-clamp-2 text-xs text-neutral-400"
      >
        {{ quiz.description }}
      </p>
      <p
        v-if="quiz.time_limit_sec"
        class="mt-1 text-xs text-neutral-500"
      >
        {{ formatDuration(quiz.time_limit_sec) }}
      </p>

      <div
        v-if="showActions"
        class="mt-auto flex items-center gap-1 border-t border-neutral-800 pt-2"
      >
        <Button
          variant="ghost"
          size="sm"
          class="flex-1"
          @click="router.push('/editor/' + quiz.id)"
        >
          <Pencil class="h-3.5 w-3.5" />
          Изменить
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Удалить тест"
          class="text-red-400 hover:bg-red-500/15 hover:text-red-600"
          @click="emit('delete', quiz)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
