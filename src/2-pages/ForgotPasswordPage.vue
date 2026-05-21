<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useAuthStore } from '@features/auth/model/useAuthStore'

const schema = z.object({
  email: z.string().email('Некорректный email'),
})

const { defineField, handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(schema),
})

const [email, emailAttrs] = defineField('email')
const isSubmitted = ref(false)
const authStore = useAuthStore()

// LOCKED Email Security: store swallows errors, UI always shows generic success — no error branch.
const onSubmit = handleSubmit(async (values) => {
  await authStore.requestPasswordReset(values.email)
  isSubmitted.value = true
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="w-full max-w-md p-6">
      <h1 class="text-2xl font-bold text-neutral-50">Восстановление пароля</h1>

      <template v-if="!isSubmitted">
        <p class="mt-2 text-sm leading-relaxed text-neutral-400">
          Введите email — отправим ссылку для сброса пароля.
        </p>

        <form class="mt-4 space-y-4" @submit="onSubmit">
          <div>
            <label for="forgot-email" class="block text-sm font-medium text-neutral-200">
              Email
            </label>
            <input
              id="forgot-email"
              v-model="email"
              v-bind="emailAttrs"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              class="mt-1 block w-full rounded-md border border-neutral-700 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ isSubmitting ? 'Отправка...' : 'Отправить ссылку' }}
          </button>
        </form>

        <RouterLink
          to="/auth"
          class="mt-4 inline-block cursor-pointer text-sm text-neutral-400 hover:text-neutral-200"
        >
          Назад ко входу
        </RouterLink>
      </template>

      <template v-else>
        <p class="mt-4 text-sm text-neutral-200">
          Если такой email зарегистрирован, мы отправили на него ссылку для сброса пароля.
        </p>
        <RouterLink
          to="/auth"
          class="mt-4 inline-block cursor-pointer text-sm text-orange-400 hover:text-orange-300"
        >
          Вернуться ко входу
        </RouterLink>
      </template>
    </div>
  </div>
</template>
