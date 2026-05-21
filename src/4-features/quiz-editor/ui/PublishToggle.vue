<script setup lang="ts">
import { computed } from 'vue'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import Switch from '@shared/ui/Switch.vue'

const store = useQuizEditorStore()
const isPublished = computed(() => store.quiz?.is_published ?? false)
</script>

<template>
  <div class="flex items-center gap-2">
    <span
      class="hidden text-sm font-medium sm:inline"
      :class="isPublished ? 'text-orange-400' : 'text-neutral-400'"
    >
      {{ isPublished ? 'Опубликован' : 'Черновик' }}
    </span>
    <Switch
      :model-value="isPublished"
      :aria-label="isPublished ? 'Опубликован' : 'Черновик'"
      @update:model-value="store.publishToggle()"
    />
  </div>
</template>
