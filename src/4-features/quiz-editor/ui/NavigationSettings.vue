<script setup lang="ts">
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import Switch from '@shared/ui/Switch.vue'

const store = useQuizEditorStore()
</script>

<template>
  <div>
    <p class="text-base font-semibold text-neutral-200">
      Настройки навигации для тестируемого
    </p>
    <div class="mt-3 flex flex-col gap-2">
      <label class="flex items-center gap-3">
        <Switch
          :model-value="store.settings.allow_back"
          @update:model-value="store.updateSettings({ allow_back: $event })"
        />
        <span class="text-sm text-neutral-200">Разрешить возврат к предыдущему вопросу</span>
      </label>
      <label class="flex items-center gap-3">
        <Switch
          :model-value="store.settings.show_stop_button"
          @update:model-value="store.updateSettings({ show_stop_button: $event })"
        />
        <span class="text-sm text-neutral-200">Показывать кнопку «Стоп»</span>
      </label>
      <label class="flex items-center gap-3">
        <Switch
          :model-value="store.settings.allow_retake"
          @update:model-value="store.updateSettings({ allow_retake: $event })"
        />
        <span class="text-sm text-neutral-200">Разрешить повторное прохождение</span>
      </label>
    </div>
  </div>
</template>
