<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Plus } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import Input from '@shared/ui/Input.vue'
import { useQuizShareStore } from '@features/quiz-share/model/useQuizShareStore'

const props = defineProps<{
  quizId: string
}>()

const store = useQuizShareStore()
const label = ref('')
const expiresAt = ref('')

async function onCreate() {
  await store.createLink(props.quizId, label.value, expiresAt.value || undefined)
  // Only clear fields on success (lastCreated set means link was created)
  if (store.lastCreated) {
    label.value = ''
    expiresAt.value = ''
  }
}
</script>

<template>
  <div class="mb-6 rounded-xl bg-neutral-800 p-4">
    <div class="mb-3">
      <label class="mb-1 block text-sm text-neutral-400">Имя тестируемого</label>
      <Input
        v-model="label"
        type="text"
        placeholder="Например: Иван Иванов"
        class="w-full"
      />
    </div>
    <div class="mb-4">
      <label class="mb-1 block text-sm text-neutral-400">Срок действия</label>
      <Input
        v-model="expiresAt"
        type="date"
        class="w-full"
        style="color-scheme: dark"
      />
    </div>
    <Button
      variant="default"
      class="w-full"
      :disabled="store.isCreating"
      @click="onCreate"
    >
      <Loader2
        v-if="store.isCreating"
        class="mr-2 h-4 w-4 animate-spin"
      />
      <Plus
        v-else
        class="mr-2 h-4 w-4"
      />
      Создать ссылку
    </Button>
  </div>
</template>
