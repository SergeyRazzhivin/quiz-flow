<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const _quizId = route.params.id as string
</script>

<template>
  <!-- Mobile notice for screens < 768px -->
  <div class="hidden md:block h-full">
    <div class="flex items-center justify-center min-h-screen">
      <p class="text-gray-500">Редактор теста (скоро)</p>
    </div>
  </div>
  <div class="flex md:hidden items-center justify-center min-h-screen p-6 text-center">
    <p>Редактор доступен только на экранах шире 768px</p>
  </div>
</template>
