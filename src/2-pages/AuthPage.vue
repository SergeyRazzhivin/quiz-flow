<script setup lang="ts">
import LoginForm from '@features/auth/ui/LoginForm.vue'
import RegisterForm from '@features/auth/ui/RegisterForm.vue'
import Tabs from '@shared/ui/Tabs.vue'
import TabsList from '@shared/ui/TabsList.vue'
import TabsTrigger from '@shared/ui/TabsTrigger.vue'
import TabsContent from '@shared/ui/TabsContent.vue'
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="w-full max-w-md p-6">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-neutral-50">Quiz Flow</h1>
        <p class="mt-2 text-sm leading-relaxed text-neutral-400">
          Создавайте тесты вручную или генерируйте их из текста с помощью ИИ,
          делитесь ссылкой с тестируемыми и смотрите статистику ответов.
        </p>
        <p class="mt-2 text-xs text-neutral-500">
          Войдите в аккаунт или зарегистрируйтесь — это займёт меньше минуты.
        </p>
      </div>
      <Tabs default-value="login" class="w-full">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="login">Войти</TabsTrigger>
          <TabsTrigger value="register">Зарегистрироваться</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <LoginForm />
        </TabsContent>
        <TabsContent value="register">
          <RegisterForm />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
