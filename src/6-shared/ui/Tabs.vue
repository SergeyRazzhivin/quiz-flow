<script setup lang="ts">
import { TabsRoot } from 'radix-vue'
import { cn } from '@shared/lib/utils'
import { computed } from 'vue'

const props = defineProps<{
  defaultValue?: string
  modelValue?: string
  class?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
const computedClass = computed(() => cn('w-full', props.class))
</script>

<template>
  <TabsRoot
    :default-value="defaultValue"
    :model-value="modelValue"
    :class="computedClass"
    @update:model-value="emit('update:modelValue', $event as string)"
  >
    <slot />
  </TabsRoot>
</template>
