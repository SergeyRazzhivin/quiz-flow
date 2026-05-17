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
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useQuizTakingStore()

async function handleFinish(): Promise<void> {
  await store.finishSession()
  emit('update:open', false)
}
</script>

<template>
  <!-- UI-SPEC section 3: Stop Confirmation Dialog -->
  <!-- Focal point: "Продолжить тест" cancel button (safe default, first focusable action) -->
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-neutral-900 p-6 shadow-lg"
      >
        <DialogTitle class="text-xl font-semibold text-neutral-50">
          Завершить тест?
        </DialogTitle>
        <DialogDescription class="mt-2 text-base text-neutral-400">
          Ваши ответы сохранены. Результат будет подсчитан по ответам на момент завершения.
        </DialogDescription>

        <!-- Actions: cancel (focal/default) + confirm destructive -->
        <div class="mt-6 flex justify-end gap-3">
          <!-- "Продолжить тест" — cancel (default focal action, UI-SPEC) -->
          <Button
            variant="outline"
            @click="emit('update:open', false)"
          >
            Продолжить тест
          </Button>
          <!-- "Завершить" — destructive confirm -->
          <Button
            variant="destructive"
            @click="handleFinish"
          >
            Завершить
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
