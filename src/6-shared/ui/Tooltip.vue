<script setup lang="ts">
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  TooltipArrow,
} from 'radix-vue'
import { cn } from '@shared/lib/utils'
import { computed } from 'vue'

const props = defineProps<{
  content?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  class?: string
}>()

const contentClass = computed(() =>
  cn(
    'z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white animate-in fade-in-0 zoom-in-95',
    props.class
  )
)
</script>

<template>
  <TooltipProvider>
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipContent :side="side ?? 'top'" :class="contentClass">
        {{ content }}
        <TooltipArrow class="fill-gray-900" />
      </TooltipContent>
    </TooltipRoot>
  </TooltipProvider>
</template>
