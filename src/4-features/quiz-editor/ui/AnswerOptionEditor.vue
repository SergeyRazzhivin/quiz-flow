<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Check } from 'lucide-vue-next'
import type { AnswerOption } from '@entities/answer-option/model'
import type { QuestionType } from '@entities/question/model'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import Tooltip from '@shared/ui/Tooltip.vue'

const props = defineProps<{
  option: AnswerOption
  type: QuestionType
}>()

const store = useQuizEditorStore()
const localBody = ref(props.option.body)
watch(() => props.option.body, (value) => { localBody.value = value })

function toggleCorrect() {
  if (props.type === 'single') {
    if (!props.option.is_correct) {
      store.updateAnswerOption(props.option.id, { is_correct: true })
    }
  } else {
    store.updateAnswerOption(props.option.id, { is_correct: !props.option.is_correct })
  }
}

function saveBody() {
  if (localBody.value !== props.option.body) {
    store.updateAnswerOption(props.option.id, { body: localBody.value })
  }
}
</script>

<template>
  <div class="flex items-center gap-2 py-1">
    <button
      type="button"
      class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border-2 transition-colors"
      :class="[
        type === 'single' ? 'rounded-full' : 'rounded',
        option.is_correct ? 'border-orange-500 bg-orange-500' : 'border-neutral-700 bg-neutral-900',
      ]"
      :aria-label="option.is_correct ? 'Правильный ответ' : 'Отметить правильным'"
      @click="toggleCorrect"
    >
      <span
        v-if="type === 'single' && option.is_correct"
        class="h-2 w-2 rounded-full bg-white"
      />
      <Check
        v-else-if="type === 'multiple' && option.is_correct"
        class="h-3 w-3 text-white"
      />
    </button>
    <input
      v-model="localBody"
      placeholder="Вариант ответа"
      class="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-neutral-50 transition-colors hover:border-neutral-800 focus:border-neutral-700 focus:outline-none"
      @blur="saveBody"
    >
    <Tooltip content="Удалить вариант">
      <button
        type="button"
        aria-label="Удалить вариант"
        class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
        @click="store.deleteAnswerOption(option.id)"
      >
        <X class="h-4 w-4" />
      </button>
    </Tooltip>
  </div>
</template>
