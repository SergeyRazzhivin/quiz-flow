<script setup lang="ts">
import LoginForm from '@features/auth/ui/LoginForm.vue'
import RegisterForm from '@features/auth/ui/RegisterForm.vue'
import Tabs from '@shared/ui/Tabs.vue'
import TabsList from '@shared/ui/TabsList.vue'
import TabsTrigger from '@shared/ui/TabsTrigger.vue'
import TabsContent from '@shared/ui/TabsContent.vue'
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <div class="w-full max-w-md p-6">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">Quiz Flow</h1>
        <p class="mt-1 text-sm text-gray-500">Создавайте и проходите тесты</p>
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
