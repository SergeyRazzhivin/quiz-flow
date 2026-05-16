<script setup lang="ts">
import { TabsContent } from 'radix-vue'
import { cn } from '@shared/lib/utils'
import { computed } from 'vue'

const props = defineProps<{
  value: string
  class?: string
}>()
const computedClass = computed(() =>
  cn('mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500', props.class)
)
</script>

<template>
  <TabsContent :value="value" :class="computedClass">
    <slot />
  </TabsContent>
</template>
