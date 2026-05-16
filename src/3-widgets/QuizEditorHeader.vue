<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import PublishToggle from '@features/quiz-editor/ui/PublishToggle.vue'
import Tooltip from '@shared/ui/Tooltip.vue'
import Button from '@shared/ui/Button.vue'

const router = useRouter()
</script>

<template>
  <header class="border-b border-neutral-800 bg-neutral-900 py-3">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-6">
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
      <PublishToggle />
    </div>
  </header>
</template>
