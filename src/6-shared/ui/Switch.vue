<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'

defineProps<{
  modelValue?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <ToggleSwitch
    class="app-switch"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<style scoped>
.app-switch {
  --p-toggleswitch-width: 2rem;
  --p-toggleswitch-height: 1.125rem;
  --p-toggleswitch-handle-size: 0.875rem;
}
</style>
