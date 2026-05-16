<script setup lang="ts">
import { TabsList } from 'radix-vue'
import { cn } from '@shared/lib/utils'
import { computed } from 'vue'

const props = defineProps<{ class?: string }>()
const computedClass = computed(() =>
  cn('inline-flex h-9 items-center justify-center rounded-lg bg-neutral-800 p-1 text-neutral-400', props.class)
)
</script>

<template>
  <TabsList :class="computedClass">
    <slot />
  </TabsList>
</template>
