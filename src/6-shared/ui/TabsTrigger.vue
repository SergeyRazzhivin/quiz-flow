<script setup lang="ts">
import { TabsTrigger } from 'radix-vue'
import { cn } from '@shared/lib/utils'
import { computed } from 'vue'

const props = defineProps<{
  value: string
  class?: string
  disabled?: boolean
}>()
const computedClass = computed(() =>
  cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow',
    props.class
  )
)
</script>

<template>
  <TabsTrigger :value="value" :disabled="disabled" :class="computedClass">
    <slot />
  </TabsTrigger>
</template>
