<script setup lang="ts">
withDefaults(defineProps<{
  value: number // 0–100 percent
  size?: 'sm' | 'md'
}>(), { size: 'sm' })
</script>

<template>
  <!-- UI-SPEC section 2: h-1 (sm) / h-2 (md) track bg-neutral-800, fill bg-orange-500, transition-all duration-300 -->
  <div :class="['w-full rounded-full bg-neutral-800', size === 'md' ? 'h-2' : 'h-1']">
    <div
      :class="['rounded-full bg-orange-500 transition-all duration-300', size === 'md' ? 'h-2' : 'h-1']"
      :style="{ width: `${value}%` }"
    />
  </div>
</template>
