<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import { useRouter, useRoute } from 'vue-router'

const schema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
})

const { defineField, handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(schema)
})

const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const onSubmit = handleSubmit(async (values) => {
  try {
    await authStore.register(values.email, values.password)
    const returnUrl = route.query.returnUrl as string | undefined
    router.push(returnUrl || '/')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Ошибка регистрации')
  }
})
</script>

<template>
  <form class="mt-4 space-y-4" @submit="onSubmit">
    <div>
      <label for="register-email" class="block text-sm font-medium text-neutral-200">
        Email
      </label>
      <input
        id="register-email"
        v-model="email"
        v-bind="emailAttrs"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        class="mt-1 block w-full rounded-md border border-neutral-700 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
    </div>

    <div>
      <label for="register-password" class="block text-sm font-medium text-neutral-200">
        Пароль
      </label>
      <input
        id="register-password"
        v-model="password"
        v-bind="passwordAttrs"
        type="password"
        autocomplete="new-password"
        placeholder="Минимум 6 символов"
        class="mt-1 block w-full rounded-md border border-neutral-700 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
    </div>

    <button
      type="submit"
      :disabled="isSubmitting"
      class="w-full cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {{ isSubmitting ? 'Регистрация...' : 'Зарегистрироваться' }}
    </button>
  </form>
</template>
