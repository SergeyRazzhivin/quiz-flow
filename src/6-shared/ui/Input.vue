<script setup lang="ts">
import { cn } from '@shared/lib/utils'
import { computed } from 'vue'

const props = defineProps<{
  class?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  modelValue?: string | number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const computedClass = computed(() =>
  cn(
    'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50',
    props.class
  )
)
</script>

<template>
  <input
    :class="computedClass"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
