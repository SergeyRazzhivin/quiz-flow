<script setup lang="ts">
import { FileQuestion, Plus, Sparkles } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import Tooltip from '@shared/ui/Tooltip.vue'

const emit = defineEmits<{
  create: []
  createAi: []
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
    <div class="mt-8 flex items-center gap-3">
      <Tooltip content="Сгенерировать новый тест из текста или файла">
        <Button
          variant="default"
          @click="emit('createAi')"
        >
          <Sparkles class="h-4 w-4" />
          Создать с ИИ
        </Button>
      </Tooltip>
      <Button
        variant="outline"
        @click="emit('create')"
      >
        <Plus class="h-4 w-4" />
        Создать первый тест
      </Button>
    </div>
  </div>
</template>
