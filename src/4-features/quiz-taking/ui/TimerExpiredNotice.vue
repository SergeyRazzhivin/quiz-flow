<script setup lang="ts">
import { Clock, Loader2 } from 'lucide-vue-next'
</script>

<template>
  <!-- D-08: non-dismissible overlay shown when the timer hits zero and auto-submit is in progress.
       UI-SPEC section 4: fixed inset-0 bg-black/60 backdrop, centered card with Clock icon + spinner. -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="flex flex-col items-center gap-4 rounded-2xl bg-neutral-900 px-10 py-8 text-center shadow-xl">
      <!-- 48px red Clock icon -->
      <Clock class="h-12 w-12 text-red-500" />

      <div class="flex flex-col items-center gap-1">
        <p class="text-xl font-semibold text-neutral-50">
          Время вышло
        </p>
        <div class="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 class="h-4 w-4 animate-spin" />
          <span>Тест отправляется автоматически...</span>
        </div>
      </div>
    </div>
  </div>
</template>
