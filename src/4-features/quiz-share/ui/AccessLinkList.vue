<script setup lang="ts">
import { Link2Off, Trash2 } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import { useQuizShareStore } from '@features/quiz-share/model/useQuizShareStore'

const store = useQuizShareStore()

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'Бессрочно'
  const date = new Date(expiresAt)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `до ${day}.${month}.${year}`
}
</script>

<template>
  <div>
    <div
      v-if="store.links.length === 0"
      class="py-8 text-center"
    >
      <Link2Off class="mx-auto h-10 w-10 text-neutral-700" />
      <p class="mt-3 text-sm text-neutral-500">
        Ссылки ещё не созданы
      </p>
    </div>

    <div
      v-else
      class="flex flex-col gap-2"
    >
      <div
        v-for="link in store.links"
        :key="link.id"
        class="flex items-center gap-3 rounded-xl bg-neutral-800 px-4 py-3"
      >
        <span class="flex-1 truncate text-base text-neutral-50">{{ link.label }}</span>
        <span class="shrink-0 text-sm text-neutral-400">@{{ link.login }}</span>
        <span
          class="shrink-0 text-sm"
          :class="link.expires_at ? 'text-neutral-400' : 'text-neutral-600'"
        >
          {{ formatExpiry(link.expires_at) }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="shrink-0 text-neutral-500 hover:text-red-500"
          :aria-label="`Удалить ссылку ${link.label}`"
          @click="store.removeLink(link.id)"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
