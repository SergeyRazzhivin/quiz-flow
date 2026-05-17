<script setup lang="ts">
import { onMounted } from 'vue'
import { Toaster } from 'vue-sonner'
import { useAuthStore } from '@features/auth/model/useAuthStore'

const authStore = useAuthStore()
onMounted(() => authStore.init())
</script>

<template>
  <RouterView />
  <Toaster
    position="top-right"
    theme="dark"
    rich-colors
  />
</template>
