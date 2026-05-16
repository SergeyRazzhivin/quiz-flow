<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { GripVertical, Trash2, Plus } from 'lucide-vue-next'
import {
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'radix-vue'
import type { Question, QuestionType } from '@entities/question/model'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import AnswerOptionEditor from './AnswerOptionEditor.vue'
import Dialog from '@shared/ui/Dialog.vue'
import Switch from '@shared/ui/Switch.vue'
import Button from '@shared/ui/Button.vue'

const props = defineProps<{ question: Question }>()
const store = useQuizEditorStore()

const number = computed(() => store.questions.findIndex(q => q.id === props.question.id) + 1)
const options = computed(() => store.answerOptions[props.question.id] ?? [])

const localBody = ref(props.question.body)
watch(() => props.question.body, (value) => { localBody.value = value })

const textareaEl = ref<HTMLTextAreaElement | null>(null)
const showDeleteDialog = ref(false)

function autoResize() {
  const el = textareaEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function saveBody() {
  if (localBody.value !== props.question.body) {
    store.updateQuestion(props.question.id, { body: localBody.value })
  }
}

function setType(type: QuestionType) {
  if (props.question.type !== type) {
    store.updateQuestion(props.question.id, { type })
  }
}

function confirmDelete() {
  showDeleteDialog.value = false
  store.deleteQuestion(props.question.id)
}

async function focus() {
  await nextTick()
  textareaEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  textareaEl.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div class="flex items-center gap-3">
      <span
        class="drag-handle flex h-11 w-6 cursor-grab items-center justify-center text-gray-300 hover:text-gray-500"
      >
        <GripVertical class="h-5 w-5" />
      </span>
      <span class="text-sm text-gray-400">Вопрос {{ number }}</span>
      <div class="ml-auto flex items-center gap-3">
        <div class="flex">
          <button
            type="button"
            class="cursor-pointer rounded-l-md border px-3 py-1 text-xs transition-colors"
            :class="question.type === 'single'
              ? 'border-violet-400 bg-violet-50 text-violet-700'
              : 'border-gray-300 bg-white text-gray-600'"
            @click="setType('single')"
          >
            Один ответ
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-r-md border border-l-0 px-3 py-1 text-xs transition-colors"
            :class="question.type === 'multiple'
              ? 'border-violet-400 bg-violet-50 text-violet-700'
              : 'border-gray-300 bg-white text-gray-600'"
            @click="setType('multiple')"
          >
            Несколько ответов
          </button>
        </div>
        <label class="flex items-center gap-2">
          <Switch
            :model-value="question.is_required"
            @update:model-value="store.updateQuestion(question.id, { is_required: $event })"
          />
          <span class="text-sm text-gray-600">Обязательный</span>
        </label>
        <button
          type="button"
          aria-label="Удалить вопрос"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50"
          @click="showDeleteDialog = true"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </div>
    </div>

    <textarea
      ref="textareaEl"
      v-model="localBody"
      rows="2"
      placeholder="Введите текст вопроса..."
      class="mt-3 min-h-[80px] w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
      @input="autoResize"
      @blur="saveBody"
    />

    <div class="mt-3 flex flex-col gap-1">
      <AnswerOptionEditor
        v-for="option in options"
        :key="option.id"
        :option="option"
        :type="question.type"
      />
      <button
        type="button"
        class="mt-1 flex w-fit cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100"
        @click="store.addAnswerOption(question.id)"
      >
        <Plus class="h-4 w-4" />
        Добавить вариант ответа
      </button>
    </div>

    <Dialog
      :open="showDeleteDialog"
      @update:open="showDeleteDialog = $event"
    >
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/40" />
        <DialogContent
          class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg"
        >
          <DialogTitle class="text-xl font-semibold text-gray-900">
            Удалить вопрос?
          </DialogTitle>
          <DialogDescription class="mt-2 text-sm text-gray-500">
            Вопрос и все варианты ответов будут удалены.
          </DialogDescription>
          <div class="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              @click="showDeleteDialog = false"
            >
              Оставить вопрос
            </Button>
            <Button
              variant="destructive"
              @click="confirmDelete"
            >
              Удалить
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  </div>
</template>
