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
  <div class="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow duration-150">
    <div class="mb-3 aspect-video overflow-hidden rounded-md bg-gray-100">
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
        <Image class="h-8 w-8 text-gray-400" />
      </div>
    </div>

    <h2 class="mb-1 line-clamp-2 text-xl font-semibold text-gray-900">
      {{ quiz.title }}
    </h2>

    <p
      v-if="quiz.description"
      class="mb-2 line-clamp-2 text-sm text-gray-500"
    >
      {{ quiz.description }}
    </p>

    <p
      v-if="quiz.time_limit_sec"
      class="text-sm text-gray-400"
    >
      {{ formatDuration(quiz.time_limit_sec) }}
    </p>

    <div
      v-if="showActions"
      class="mt-3 flex items-center justify-end gap-2"
    >
      <span
        class="rounded-full px-2 py-0.5 text-xs font-medium"
        :class="quiz.is_published ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'"
      >
        {{ quiz.is_published ? 'Опубликован' : 'Черновик' }}
      </span>
      <Button
        variant="ghost"
        size="sm"
        @click="router.push('/editor/' + quiz.id)"
      >
        <Pencil class="h-4 w-4" />
        Редактировать
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="text-red-500 hover:text-red-600 hover:bg-red-50"
        @click="emit('delete', quiz)"
      >
        <Trash2 class="h-4 w-4" />
        Удалить
      </Button>
    </div>
  </div>
</template>
