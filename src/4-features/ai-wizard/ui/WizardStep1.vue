<script setup lang="ts">
// Step 1 — quiz title (AI-02). Copy verbatim from 03-UI-SPEC "Step 1".
import { useAiWizardStore } from '@features/ai-wizard/model/useAiWizardStore'
import Input from '@shared/ui/Input.vue'

const store = useAiWizardStore()
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold text-neutral-50">Шаг 1. Название</h2>

    <div class="space-y-2">
      <label
        for="wizard-title"
        class="block text-sm font-semibold text-neutral-200"
      >
        Название теста
      </label>
      <Input
        id="wizard-title"
        v-model="store.form.title"
        placeholder="Например: История России, глава 5"
      />
      <p
        v-if="store.form.title.trim().length === 0"
        class="text-xs text-red-400"
      >
        Введите название теста
      </p>
      <p
        v-else
        class="text-xs text-neutral-500"
      >
        Название можно изменить позже в редакторе
      </p>
    </div>
  </div>
</template>
