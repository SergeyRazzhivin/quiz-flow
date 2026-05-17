<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: number // 0–100 percent
  size?: 'sm' | 'md'
}>(), { size: 'sm' })

// WR-06: clamp to the 0–100 track so the fill never overflows or goes negative.
const clampedValue = computed(() => Math.max(0, Math.min(100, props.value)))
</script>

<template>
  <!-- UI-SPEC section 2: h-1 (sm) / h-2 (md) track bg-neutral-800, fill bg-orange-500, transition-all duration-300 -->
  <div :class="['w-full rounded-full bg-neutral-800', size === 'md' ? 'h-2' : 'h-1']">
    <div
      :class="['rounded-full bg-orange-500 transition-all duration-300', size === 'md' ? 'h-2' : 'h-1']"
      :style="{ width: `${clampedValue}%` }"
    />
  </div>
</template>
