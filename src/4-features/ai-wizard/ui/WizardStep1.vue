<script setup lang="ts">
// Step 1 — quiz title (AI-02). Copy verbatim from 03-UI-SPEC "Step 1".
import { Sparkles } from 'lucide-vue-next'
import { useAiWizardStore } from '@features/ai-wizard/model/useAiWizardStore'
import Input from '@shared/ui/Input.vue'

const store = useAiWizardStore()

const examples = [
  'История России, глава 5',
  'Основы JavaScript',
  'Биология: строение клетки',
  'Английский: Present Perfect',
]
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-start gap-3">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
        <Sparkles class="h-5 w-5" />
      </div>
      <div>
        <h2 class="text-xl font-semibold text-neutral-50">Шаг 1. Название</h2>
        <p class="mt-1 text-sm text-neutral-400">
          Дайте тесту название — по нему ИИ поймёт тему. На следующих шагах
          вы добавите учебный материал и зададите параметры генерации.
        </p>
      </div>
    </div>

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

    <div class="space-y-2">
      <p class="text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Примеры названий
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="example in examples"
          :key="example"
          type="button"
          class="cursor-pointer rounded-lg border border-neutral-800 bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-orange-500/40 hover:text-neutral-50"
          @click="store.form.title = example"
        >
          {{ example }}
        </button>
      </div>
    </div>
  </div>
</template>
