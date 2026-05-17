<script setup lang="ts">
defineProps<{
  value: number // 0–100 percent
}>()
</script>

<template>
  <!-- UI-SPEC section 2: h-1 track bg-neutral-800, fill bg-orange-500, transition-all duration-300 -->
  <div class="h-1 w-full rounded-full bg-neutral-800">
    <div
      class="h-1 rounded-full bg-orange-500 transition-all duration-300"
      :style="{ width: `${value}%` }"
    />
  </div>
</template>
