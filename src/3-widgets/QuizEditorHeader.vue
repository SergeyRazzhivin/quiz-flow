<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, BarChart3, Link } from 'lucide-vue-next'
import PublishToggle from '@features/quiz-editor/ui/PublishToggle.vue'
import Tooltip from '@shared/ui/Tooltip.vue'
import Button from '@shared/ui/Button.vue'
import AccessLinksModal from './AccessLinksModal.vue'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'

const router = useRouter()
const editorStore = useQuizEditorStore()
const modalOpen = ref(false)
</script>

<template>
  <header class="border-b border-neutral-800 bg-neutral-900 py-3">
    <div class="mx-auto flex max-w-6xl items-center gap-2 px-4 sm:px-6">
      <Tooltip content="Вернуться к списку тестов">
        <Button
          variant="ghost"
          size="icon"
          class="-ml-2 shrink-0"
          aria-label="Вернуться к списку тестов"
          @click="router.push('/my')"
        >
          <ArrowLeft class="h-5 w-5" />
        </Button>
      </Tooltip>
      <div class="ml-auto flex items-center gap-2 sm:gap-3">
        <Button
          v-if="editorStore.quiz"
          variant="outline"
          size="sm"
          aria-label="Статистика"
          @click="router.push(`/quiz/${editorStore.quiz.id}/stats`)"
        >
          <BarChart3 class="h-4 w-4" />
          <span class="hidden sm:inline">Статистика</span>
        </Button>
        <Button
          v-if="editorStore.quiz"
          variant="outline"
          size="sm"
          aria-label="Ссылки доступа"
          @click="modalOpen = true"
        >
          <Link class="h-4 w-4" />
          <span class="hidden sm:inline">Ссылки доступа</span>
        </Button>
        <PublishToggle />
      </div>
    </div>
  </header>

  <AccessLinksModal
    v-if="editorStore.quiz"
    v-model:open="modalOpen"
    :quiz-id="editorStore.quiz.id"
  />
</template>
