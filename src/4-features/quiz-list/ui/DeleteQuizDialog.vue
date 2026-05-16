<script setup lang="ts">
import {
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'radix-vue'
import Dialog from '@shared/ui/Dialog.vue'
import Button from '@shared/ui/Button.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-neutral-900 p-6 shadow-lg"
      >
        <DialogTitle class="text-xl font-semibold text-neutral-50">
          Удалить тест?
        </DialogTitle>
        <DialogDescription class="mt-2 text-sm text-neutral-400">
          Это действие нельзя отменить. Все вопросы и настройки теста будут удалены.
        </DialogDescription>
        <div class="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            @click="emit('update:open', false)"
          >
            Оставить тест
          </Button>
          <Button
            variant="destructive"
            @click="emit('confirm')"
          >
            Удалить
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
