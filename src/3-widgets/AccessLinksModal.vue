<script setup lang="ts">
import { watch } from 'vue'
import {
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from 'radix-vue'
import { X } from 'lucide-vue-next'
import Dialog from '@shared/ui/Dialog.vue'
import Button from '@shared/ui/Button.vue'
import AccessLinkForm from '@features/quiz-share/ui/AccessLinkForm.vue'
import AccessLinkCreated from '@features/quiz-share/ui/AccessLinkCreated.vue'
import AccessLinkList from '@features/quiz-share/ui/AccessLinkList.vue'
import { useQuizShareStore } from '@features/quiz-share/model/useQuizShareStore'

const props = defineProps<{
  open: boolean
  quizId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useQuizShareStore()

// Load links when the modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.quizId) {
      void store.loadLinks(props.quizId)
    }
  },
)
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 flex w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-neutral-900 p-6 shadow-lg"
        style="max-height: 80vh"
      >
        <div class="mb-4 flex items-center justify-between">
          <DialogTitle class="text-xl font-semibold text-neutral-50">
            Ссылки доступа
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            @click="emit('update:open', false)"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="flex-1 overflow-y-auto">
          <AccessLinkForm :quiz-id="quizId" />
          <AccessLinkCreated />
          <AccessLinkList />
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
