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
        option.is_correct ? 'border-violet-600 bg-violet-600' : 'border-gray-300 bg-white',
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
      class="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-gray-900 transition-colors hover:border-gray-200 focus:border-gray-300 focus:outline-none"
      @blur="saveBody"
    >
    <Tooltip content="Удалить вариант">
      <button
        type="button"
        aria-label="Удалить вариант"
        class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        @click="store.deleteAnswerOption(option.id)"
      >
        <X class="h-4 w-4" />
      </button>
    </Tooltip>
  </div>
</template>
