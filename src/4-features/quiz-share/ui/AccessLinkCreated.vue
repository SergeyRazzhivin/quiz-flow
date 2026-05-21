<script setup lang="ts">
import { ref } from 'vue'
import { Copy } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import { useQuizShareStore } from '@features/quiz-share/model/useQuizShareStore'

const store = useQuizShareStore()
const copied = ref(false)

// import.meta.env.BASE_URL ends with '/'. On GitHub Pages it's '/quiz-flow/',
// locally it's '/'. Trimming the trailing slash keeps the joined link clean.
const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '')

async function copyCredentials() {
  if (!store.lastCreated) return
  const { token, login, password } = store.lastCreated
  const text = [
    `Ссылка: ${baseUrl}/q/${token}`,
    `Логин: ${login}`,
    `Пароль: ${password}`,
  ].join('\n')

  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div
    v-if="store.lastCreated"
    class="mb-6 rounded-xl border border-orange-500 bg-neutral-800 p-4"
  >
    <p class="mb-3 text-sm font-semibold text-neutral-50">
      Данные для доступа
    </p>
    <pre
      class="select-all whitespace-pre-wrap break-all rounded-lg bg-neutral-900 p-3 font-mono text-sm leading-relaxed text-neutral-300"
    >Ссылка: {{ `${baseUrl}/q/${store.lastCreated.token}` }}
Логин: {{ store.lastCreated.login }}
Пароль: {{ store.lastCreated.password }}</pre>
    <p class="mt-2 text-sm text-amber-400">
      Пароль показывается только сейчас и не может быть восстановлен.
    </p>
    <Button
      variant="default"
      class="mt-3 w-full"
      @click="copyCredentials"
    >
      <Copy class="mr-2 h-4 w-4" />
      {{ copied ? 'Скопировано' : 'Скопировать' }}
    </Button>
  </div>
</template>
