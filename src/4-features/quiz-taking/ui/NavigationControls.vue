<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'

defineProps<{
  canGoBack: boolean       // false → "Назад" disabled when allow_back is on but first question
  allowBack: boolean       // quiz.settings.allow_back — controls visibility of "Назад"
  canGoForward: boolean    // false when required question unanswered (D-07)
  isLastQuestion: boolean  // true → show "Завершить" instead of "Вперёд"
  isFirstQuestion: boolean // true → "Назад" rendered but disabled
}>()

const emit = defineEmits<{
  back: []
  forward: []
  finish: [] // opens StopConfirmDialog
}>()
</script>

<template>
  <!-- UI-SPEC section 2 Navigation Footer: pt-4 flex items-center justify-between mt-auto -->
  <div class="mt-auto flex items-center justify-between pt-4">
    <!-- "Назад": absent entirely when allow_back is false (UI-SPEC) -->
    <!-- When allow_back is true: rendered; disabled on first question -->
    <Button
      v-if="allowBack"
      variant="outline"
      :disabled="!canGoBack"
      @click="emit('back')"
    >
      <ChevronLeft class="h-4 w-4" />
      Назад
    </Button>

    <!-- Spacer when "Назад" is absent to keep "Вперёд"/"Завершить" right-aligned -->
    <span v-else />

    <!-- "Завершить" on last question (opens confirm dialog) -->
    <Button
      v-if="isLastQuestion"
      variant="default"
      @click="emit('finish')"
    >
      Завершить
    </Button>

    <!-- "Вперёд" on non-last questions — disabled by D-07 required-question gate -->
    <Button
      v-else
      variant="outline"
      :disabled="!canGoForward"
      @click="emit('forward')"
    >
      Вперёд
      <ChevronRight class="h-4 w-4" />
    </Button>
  </div>
</template>
