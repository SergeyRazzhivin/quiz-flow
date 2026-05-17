<script setup lang="ts">
import { Clock } from 'lucide-vue-next'

defineProps<{
  seconds: number  // remaining seconds, computed by store
  isAlert: boolean // true when <= 20% remaining (store.isTimerCritical)
}>()

// Format MM:SS — display concern only, not in store
function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
</script>

<template>
  <!-- UI-SPEC section 2: pill bg-neutral-800 rounded-full px-3 py-1, tabular-nums -->
  <!-- Normal: text-neutral-400 / Alert: text-red-500 font-semibold (color only, no animation) -->
  <div
    class="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1"
    :class="isAlert ? 'text-red-500' : 'text-neutral-400'"
  >
    <Clock class="h-4 w-4" />
    <span
      class="tabular-nums text-base"
      :class="{ 'font-semibold': isAlert }"
    >
      {{ formatTime(seconds) }}
    </span>
  </div>
</template>
