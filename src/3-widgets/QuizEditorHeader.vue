<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import QuizMetaForm from '@features/quiz-editor/ui/QuizMetaForm.vue'
import CoverUpload from '@features/quiz-editor/ui/CoverUpload.vue'
import PublishToggle from '@features/quiz-editor/ui/PublishToggle.vue'
import Tooltip from '@shared/ui/Tooltip.vue'
import Button from '@shared/ui/Button.vue'

const store = useQuizEditorStore()
const router = useRouter()
</script>

<template>
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <div class="mx-auto max-w-7xl">
      <div class="flex items-center gap-3">
        <Tooltip content="Вернуться к списку тестов">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Вернуться к списку тестов"
            @click="router.push('/my')"
          >
            <ArrowLeft class="h-5 w-5" />
          </Button>
        </Tooltip>
        <input
          v-model="store.title"
          placeholder="Без названия"
          class="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xl font-semibold text-gray-900 transition-colors hover:border-gray-200 focus:border-gray-300 focus:outline-none"
        >
        <PublishToggle />
      </div>
      <div class="mt-3 flex items-start gap-4">
        <QuizMetaForm />
        <CoverUpload />
      </div>
    </div>
  </header>
</template>
