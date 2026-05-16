<script setup lang="ts">
import { FileQuestion, Plus } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'

const emit = defineEmits<{
  create: []
}>()
</script>

<template>
  <div class="flex min-h-[400px] flex-col items-center justify-center">
    <FileQuestion class="h-16 w-16 text-neutral-600" />
    <h2 class="mt-6 text-2xl font-semibold text-neutral-50">
      У вас пока нет тестов
    </h2>
    <p class="mt-2 max-w-sm text-center text-base text-neutral-400">
      Создайте первый тест и начните делиться им с участниками.
    </p>
    <Button
      class="mt-8"
      @click="emit('create')"
    >
      <Plus class="h-4 w-4" />
      Создать первый тест
    </Button>
  </div>
</template>
