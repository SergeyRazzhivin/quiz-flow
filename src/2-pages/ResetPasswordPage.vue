<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import { supabase } from '@shared/api/supabase'

type RecoveryState = 'checking' | 'ready' | 'invalid'

const recoveryState = ref<RecoveryState>('checking')
const router = useRouter()
const authStore = useAuthStore()

let subscription: { unsubscribe(): void } | null = null
let timeoutHandle: number | null = null

// LOCKED Failure States (07-CONTEXT.md): require a real PASSWORD_RECOVERY session
// within ~1.5 s of mount; otherwise show the stale-link error card. NEVER silently
// render the password form with an unrelated (already-signed-in) session.
onMounted(async () => {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      recoveryState.value = 'ready'
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
    }
  })
  subscription = data.subscription

  // Probe immediately in case the recovery event fired before the listener attached.
  const { data: { session } } = await supabase.auth.getSession()
  if (session && recoveryState.value === 'checking') {
    recoveryState.value = 'ready'
  }

  timeoutHandle = window.setTimeout(() => {
    if (recoveryState.value === 'checking') {
      recoveryState.value = 'invalid'
    }
  }, 1500)
})

onBeforeUnmount(() => {
  subscription?.unsubscribe()
  if (timeoutHandle !== null) clearTimeout(timeoutHandle)
})

const schema = z
  .object({
    password: z.string().min(6, 'Минимум 6 символов'),
    confirm: z.string().min(6, 'Минимум 6 символов'),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Пароли не совпадают',
  })

const { defineField, handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(schema),
})

const [password, passwordAttrs] = defineField('password')
const [confirm, confirmAttrs] = defineField('confirm')

const onSubmit = handleSubmit(async (values) => {
  try {
    await authStore.updatePassword(values.password)
    // Refresh authStore.user from the now-active session before navigating.
    await authStore.init()
    toast.success('Пароль обновлён')
    router.push('/my')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Не удалось обновить пароль')
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="w-full max-w-md p-6">
      <h1 class="text-2xl font-bold text-neutral-50">Новый пароль</h1>

      <p
        v-if="recoveryState === 'checking'"
        class="mt-4 text-sm text-neutral-400"
      >
        Проверка ссылки...
      </p>

      <template v-else-if="recoveryState === 'invalid'">
        <p class="mt-4 text-sm text-red-400">
          Ссылка недействительна или истекла. Запросите новую ссылку.
        </p>
        <RouterLink
          to="/forgot-password"
          class="mt-4 inline-block cursor-pointer text-sm text-orange-400 hover:text-orange-300"
        >
          Запросить новую ссылку
        </RouterLink>
      </template>

      <template v-else>
        <p class="mt-2 text-sm leading-relaxed text-neutral-400">
          Введите новый пароль и подтверждение.
        </p>

        <form class="mt-4 space-y-4" @submit="onSubmit">
          <div>
            <label for="reset-password" class="block text-sm font-medium text-neutral-200">
              Новый пароль
            </label>
            <input
              id="reset-password"
              v-model="password"
              v-bind="passwordAttrs"
              type="password"
              autocomplete="new-password"
              placeholder="Минимум 6 символов"
              class="mt-1 block w-full rounded-md border border-neutral-700 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label for="reset-confirm" class="block text-sm font-medium text-neutral-200">
              Подтвердите пароль
            </label>
            <input
              id="reset-confirm"
              v-model="confirm"
              v-bind="confirmAttrs"
              type="password"
              autocomplete="new-password"
              placeholder="Повторите пароль"
              class="mt-1 block w-full rounded-md border border-neutral-700 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ isSubmitting ? 'Сохранение...' : 'Сохранить пароль' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>
