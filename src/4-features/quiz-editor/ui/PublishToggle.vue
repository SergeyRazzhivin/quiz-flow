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
      class="text-sm font-medium"
      :class="isPublished ? 'text-emerald-600' : 'text-gray-500'"
    >
      {{ isPublished ? 'Опубликован' : 'Черновик' }}
    </span>
    <Switch
      :model-value="isPublished"
      class="data-[state=checked]:bg-emerald-500"
      @update:model-value="store.publishToggle()"
    />
  </div>
</template>
