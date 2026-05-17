<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  heading: string
  body: string
}>()
</script>

<template>
  <!-- Reusable centered card for graceful states (D-19: not_ready, invalid, etc.) -->
  <!-- UI-SPEC section 6 -->
  <div class="flex min-h-screen flex-col items-center justify-center px-4 py-12">
    <div class="flex w-full max-w-md flex-col items-center rounded-2xl bg-neutral-900 p-8 text-center shadow-lg">
      <component :is="icon" class="mb-4 h-12 w-12 text-neutral-600" />
      <p class="mb-2 text-xl font-semibold text-neutral-50">{{ heading }}</p>
      <p class="text-base text-neutral-400">{{ body }}</p>
    </div>
  </div>
</template>
