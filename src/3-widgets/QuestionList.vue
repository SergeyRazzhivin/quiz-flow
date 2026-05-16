<script setup lang="ts">
import { nextTick } from 'vue'
import { Plus } from 'lucide-vue-next'
import { VueDraggable } from '@shared/lib/draggable'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import QuestionEditor from '@features/quiz-editor/ui/QuestionEditor.vue'
import Button from '@shared/ui/Button.vue'

const store = useQuizEditorStore()
const cardRefs = new Map<string, { focus: () => void }>()

function setCardRef(id: string, el: unknown) {
  if (el) cardRefs.set(id, el as { focus: () => void })
  else cardRefs.delete(id)
}

function onDragEnd() {
  store.questions.forEach((q, index) => { q.order_index = index })
  void store.reorderQuestions(store.questions)
}

async function onAddQuestion() {
  const id = await store.addQuestion()
  if (!id) return
  await nextTick()
  cardRefs.get(id)?.focus()
}
</script>

<template>
  <div>
    <VueDraggable
      v-model="store.questions"
      handle=".drag-handle"
      :animation="150"
      @end="onDragEnd"
    >
      <QuestionEditor
        v-for="q in store.questions"
        :key="q.id"
        :ref="(el) => setCardRef(q.id, el)"
        :question="q"
      />
    </VueDraggable>

    <p
      v-if="store.questions.length === 0"
      class="mb-4 text-sm text-neutral-500"
    >
      В тесте пока нет вопросов. Добавьте первый.
    </p>

    <Button
      class="mt-2"
      @click="onAddQuestion"
    >
      <Plus class="h-4 w-4" />
      Добавить вопрос
    </Button>
  </div>
</template>
