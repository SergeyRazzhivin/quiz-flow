<script setup lang="ts">
// Step 4 — generation progress (AI-07). Stage-based spinner (D-10, no fake
// percentage bar) + the D-11 in-page failure state with recovery actions.
// Copy verbatim from 03-UI-SPEC "Step 4" / "Error state".
import { computed } from 'vue'
import { Loader2, AlertTriangle, RotateCw } from 'lucide-vue-next'
import { useAiWizardStore } from '@features/ai-wizard/model/useAiWizardStore'
import type { AiJobStage } from '@entities/ai-job/model'
import Button from '@shared/ui/Button.vue'

const store = useAiWizardStore()

const STAGE_MESSAGES: Record<AiJobStage, string> = {
  reading: 'Изучаю материал…',
  generating: 'Составляю вопросы…',
  saving: 'Сохраняю тест…',
  done: 'Готово! Открываю редактор…',
}

// The wizard never shows a blank screen — there is always a visible message (D-10).
const stageLine = computed(() =>
  store.currentStage ? STAGE_MESSAGES[store.currentStage] : 'Изучаю материал…',
)

// WR-02 / WR-03: when the failure is a client-correctable EF 400, show the
// specific instruction instead of the generic "что-то пошло не так" copy.
const failureBody = computed(
  () =>
    store.failureMessage ??
    'Что-то пошло не так при обработке материала. Проверьте исходный текст ' +
      'и попробуйте ещё раз — введённые данные сохранены.',
)
</script>

<template>
  <div class="flex flex-1 items-center justify-center">
    <div class="w-full max-w-md rounded-2xl bg-neutral-900 p-8 text-center">
      <!-- Failure state (D-11) -->
      <template v-if="store.generationStatus === 'failed'">
        <AlertTriangle class="mx-auto h-8 w-8 text-red-400" />
        <h2 class="mt-4 text-2xl font-semibold text-neutral-50">
          Не удалось сгенерировать тест
        </h2>
        <p class="mt-2 text-sm text-neutral-400">
          {{ failureBody }}
        </p>
        <div class="mt-6 flex justify-center gap-3">
          <Button @click="store.retry()">
            <RotateCw class="h-4 w-4" />
            Повторить
          </Button>
          <Button
            variant="outline"
            @click="store.backToParams()"
          >
            Изменить параметры
          </Button>
        </div>
      </template>

      <!-- In-progress state (D-10) -->
      <template v-else>
        <Loader2 class="mx-auto h-8 w-8 animate-spin text-orange-500" />
        <h2 class="mt-4 text-2xl font-semibold text-neutral-50">
          {{ stageLine }}
        </h2>
        <p class="mt-2 text-sm text-neutral-400">
          Это занимает 10–30 секунд. Не закрывайте страницу.
        </p>
        <p class="mt-4 text-xs text-neutral-600">
          Текст материала передаётся в OpenAI для генерации.
        </p>
      </template>
    </div>
  </div>
</template>
