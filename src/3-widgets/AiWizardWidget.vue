<script setup lang="ts">
// AiWizardWidget — owns the ai-wizard store, renders the stepper + active step
// + footer nav, and registers the D-12 step-4 leave guards.
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import {
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'radix-vue'
import { X } from 'lucide-vue-next'
import { useAiWizardStore } from '@features/ai-wizard/model/useAiWizardStore'
import WizardStepper from '@features/ai-wizard/ui/WizardStepper.vue'
import WizardStep1 from '@features/ai-wizard/ui/WizardStep1.vue'
import WizardStep2 from '@features/ai-wizard/ui/WizardStep2.vue'
import WizardStep3 from '@features/ai-wizard/ui/WizardStep3.vue'
import WizardStep4 from '@features/ai-wizard/ui/WizardStep4.vue'
import Button from '@shared/ui/Button.vue'
import Dialog from '@shared/ui/Dialog.vue'

const router = useRouter()
const store = useAiWizardStore()

// D-12 leave-confirmation dialog state.
const leaveDialogOpen = ref(false)
// IN-06: both leave-guard handles are declared here, BEFORE onBeforeRouteLeave,
// so there is no declared-after-use ordering. The guard callback runs lazily at
// navigation time, so the prior ordering was technically safe — but fragile and
// confusing to a reader. Keep both `let` bindings together, above their first use.
let pendingLeave: (() => void) | null = null
let leaveResolveCancel: (() => void) | null = null

// Block step-4 exit while a generation is in flight (D-12).
function isLocked(): boolean {
  return store.step === 4 && store.generationStatus === 'pending'
}

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (isLocked()) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  // D-02 — the wizard always creates a new quiz. The store is a Pinia singleton,
  // so reset it on every entry to /ai-wizard to drop any stale completed state.
  store.resetWizard()
  window.addEventListener('beforeunload', onBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  store.cleanup()
})

// onBeforeRouteLeave — show the D-12 confirmation when leaving step 4 mid-run.
onBeforeRouteLeave(() => {
  if (!isLocked()) return true
  return new Promise<boolean>((resolve) => {
    leaveDialogOpen.value = true
    pendingLeave = () => resolve(true)
    // The Dialog's update:open(false) on cancel resolves false.
    leaveResolveCancel = () => resolve(false)
  })
})

function confirmLeave(): void {
  leaveDialogOpen.value = false
  pendingLeave?.()
  pendingLeave = null
  leaveResolveCancel = null
}

function cancelLeave(): void {
  leaveDialogOpen.value = false
  leaveResolveCancel?.()
  pendingLeave = null
  leaveResolveCancel = null
}

// Top-left exit affordance — immediate on steps 1-3, guarded on step 4.
function exitWizard(): void {
  void router.push('/my')
}

function onPrimary(): void {
  if (store.step === 3) {
    void store.startGeneration()
  } else {
    store.next()
  }
}
</script>

<template>
  <div class="wizard-shell">
    <!-- Header row: title + stepper + exit affordance -->
    <header class="relative mx-auto w-full max-w-7xl px-6 pt-8 pb-4">
      <button
        type="button"
        aria-label="Закрыть мастер"
        class="absolute left-6 top-7 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition-colors hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-100"
        @click="exitWizard"
      >
        <X class="h-[18px] w-[18px]" />
      </button>
      <h1 class="text-center text-2xl font-semibold text-neutral-50">
        Создание теста с ИИ
      </h1>
      <p class="mt-1 text-center text-sm text-neutral-400">
        Загрузите материал — ИИ соберёт готовый тест с вопросами за несколько секунд.
      </p>
      <div class="mt-6">
        <WizardStepper />
      </div>
    </header>

    <!-- Step body -->
    <main class="wizard-body">
      <div class="mx-auto w-full max-w-7xl px-6 py-6">
        <div class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm sm:p-8">
          <WizardStep1 v-if="store.step === 1" />
          <WizardStep2 v-else-if="store.step === 2" />
          <WizardStep3 v-else-if="store.step === 3" />
          <WizardStep4 v-else />
        </div>

        <!-- Step nav — sits right under the step card; hidden on step 4 (D-12) -->
        <div
          v-if="store.step !== 4"
          class="mt-6 flex items-center justify-end gap-3"
        >
          <Button
            v-if="store.step > 1"
            variant="outline"
            @click="store.back()"
          >
            Назад
          </Button>
          <Button
            :disabled="!store.isStepValid"
            @click="onPrimary"
          >
            {{ store.step === 3 ? 'Сгенерировать' : 'Далее' }}
          </Button>
        </div>
      </div>
    </main>

    <!-- D-12 leave confirmation -->
    <Dialog
      :open="leaveDialogOpen"
      @update:open="(v) => { if (!v) cancelLeave() }"
    >
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/40" />
        <DialogContent
          class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-neutral-900 p-6 shadow-lg"
        >
          <DialogTitle class="text-xl font-semibold text-neutral-50">
            Прервать генерацию?
          </DialogTitle>
          <DialogDescription class="mt-2 text-sm text-neutral-400">
            Тест ещё не готов. Если вы уйдёте сейчас, генерация прервётся
            и результат не сохранится.
          </DialogDescription>
          <div class="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              @click="cancelLeave"
            >
              Остаться
            </Button>
            <Button @click="confirmLeave">
              Покинуть
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  </div>
</template>

<style scoped>
/* auto 1fr auto grid at 100dvh — matches the editor's shell discipline. */
.wizard-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100dvh;
  overflow: hidden;
  /* Transparent — the global #app dot-grid backdrop shows through. */
}

.wizard-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
}
</style>
