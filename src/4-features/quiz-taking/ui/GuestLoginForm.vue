<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2 } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import Input from '@shared/ui/Input.vue'
import { useQuizTakingStore } from '@features/quiz-taking/model/useQuizTakingStore'

const store = useQuizTakingStore()
const login = ref('')
const password = ref('')
const isSubmitting = ref(false)

async function onStart() {
  if (!login.value || !password.value) return
  isSubmitting.value = true
  try {
    await store.verifyAccess(login.value, password.value)
    // On success: verifyAccess starts the session and the store goes straight to
    // sessionStatus='active' — the quiz begins immediately (supersedes D-02).
  } catch {
    // Wrong credentials — show toast, do NOT clear fields (UI-SPEC section 1)
    toast.error('Неверный логин или пароль.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <label class="mb-1 block text-sm text-neutral-400">Логин</label>
    <Input
      v-model="login"
      type="text"
      autocomplete="username"
      class="mb-4 w-full"
      :disabled="isSubmitting"
    />
    <label class="mb-1 block text-sm text-neutral-400">Пароль</label>
    <Input
      v-model="password"
      type="password"
      autocomplete="current-password"
      class="mb-6 w-full"
      :disabled="isSubmitting"
    />
    <Button
      variant="default"
      class="w-full"
      :disabled="isSubmitting || !login || !password"
      @click="onStart"
    >
      <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
      Начать
    </Button>
  </div>
</template>
