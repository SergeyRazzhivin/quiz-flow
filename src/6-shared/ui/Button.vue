<script setup lang="ts">
import { type VariantProps, cva } from 'class-variance-authority'
import { cn } from '@shared/lib/utils'
import { computed } from 'vue'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline:     'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
        secondary:   'bg-gray-100 text-gray-900 hover:bg-gray-200',
        ghost:       'hover:bg-gray-100 text-gray-700',
        link:        'text-violet-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 rounded-md px-3 text-xs',
        lg:      'h-10 rounded-md px-8',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>

const props = withDefaults(defineProps<{
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'default',
  size: 'default',
  type: 'button',
})

const computedClass = computed(() => cn(buttonVariants({ variant: props.variant, size: props.size }), props.class))
</script>

<template>
  <button
    :class="computedClass"
    :disabled="disabled"
    :type="type"
  >
    <slot />
  </button>
</template>
