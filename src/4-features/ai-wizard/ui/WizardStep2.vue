<script setup lang="ts">
// Step 2 — source material (AI-03). A Tabs toggle between paste-text and
// upload-file (D-04), plus an always-visible clarifying-prompt field (D-05).
// Copy verbatim from 03-UI-SPEC "Step 2".
import { ref } from 'vue'
import { FileUp, X } from 'lucide-vue-next'
import { useAiWizardStore } from '@features/ai-wizard/model/useAiWizardStore'
import { formatBytes } from '@shared/lib/format'
import Tabs from '@shared/ui/Tabs.vue'
import TabsList from '@shared/ui/TabsList.vue'
import TabsTrigger from '@shared/ui/TabsTrigger.vue'
import TabsContent from '@shared/ui/TabsContent.vue'
import Button from '@shared/ui/Button.vue'

const store = useAiWizardStore()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)

const ACCEPT =
  'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function onModeChange(value: string): void {
  store.form.sourceMode = value === 'file' ? 'file' : 'text'
}

function openPicker(): void {
  fileInput.value?.click()
}

function onFileChange(e: Event): void {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) store.form.file = file
  target.value = ''
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) store.form.file = file
}

function clearFile(): void {
  store.form.file = null
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold text-neutral-50">Шаг 2. Исходный материал</h2>

    <Tabs
      :model-value="store.form.sourceMode"
      @update:model-value="onModeChange"
    >
      <TabsList class="w-full">
        <TabsTrigger
          value="text"
          class="flex-1"
        >
          Вставить текст
        </TabsTrigger>
        <TabsTrigger
          value="file"
          class="flex-1"
        >
          Загрузить файл
        </TabsTrigger>
      </TabsList>

      <!-- Paste-text tab -->
      <TabsContent
        value="text"
        class="mt-3 space-y-2"
      >
        <textarea
          v-model="store.form.sourceText"
          rows="10"
          placeholder="Вставьте сюда текст, по которому нужно составить тест…"
          class="w-full rounded-2xl border border-neutral-800 bg-[#101010] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
        />
        <p class="text-xs text-neutral-500">
          До 12 000 символов. Длинный текст будет обрезан — тест составится по первой части.
        </p>
      </TabsContent>

      <!-- Upload-file tab -->
      <TabsContent
        value="file"
        class="mt-3 space-y-2"
      >
        <input
          ref="fileInput"
          type="file"
          :accept="ACCEPT"
          class="hidden"
          @change="onFileChange"
        >

        <div
          v-if="store.form.file"
          class="flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-700 bg-neutral-900"
        >
          <FileUp class="h-8 w-8 text-orange-500" />
          <span class="mt-2 text-sm text-neutral-200">
            {{ store.form.file.name }} · {{ formatBytes(store.form.file.size) }}
          </span>
          <Button
            variant="ghost"
            size="sm"
            class="mt-2 text-neutral-400"
            @click="clearFile"
          >
            <X class="h-4 w-4" />
            Убрать файл
          </Button>
        </div>

        <div
          v-else
          class="flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-neutral-900 transition-colors"
          :class="isDragOver ? 'border-orange-500 bg-orange-500/15' : 'border-neutral-700'"
          @click="openPicker"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop="onDrop"
        >
          <FileUp class="h-8 w-8 text-neutral-600" />
          <span class="mt-1 text-sm text-neutral-500">
            {{ isDragOver ? 'Отпустите для загрузки' : 'Перетащите файл или нажмите для выбора' }}
          </span>
        </div>

        <p class="text-xs text-neutral-500">
          PDF или DOCX, до 1 МБ (Free) / 5 МБ (Pro)
        </p>
        <p
          v-if="store.form.file && !store.isFileValid"
          class="text-xs text-red-400"
        >
          {{
            store.form.file.type !== 'application/pdf' &&
              store.form.file.type !==
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              ? 'Поддерживаются только PDF и DOCX'
              : `Файл больше ${formatBytes(store.planMaxFileBytes)}. Уменьшите файл или удалите лишние страницы.`
          }}
        </p>
      </TabsContent>
    </Tabs>

    <!-- Always-visible clarifying prompt (D-05 — shared across both tabs) -->
    <div class="space-y-2">
      <label
        for="wizard-clarify"
        class="block text-sm font-semibold text-neutral-200"
      >
        На что сделать акцент
      </label>
      <textarea
        id="wizard-clarify"
        v-model="store.form.clarifyingPrompt"
        rows="3"
        placeholder="Например: проверить знание персонажей и ключевых событий"
        class="w-full rounded-2xl border border-neutral-800 bg-[#101010] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
      />
      <p class="text-xs text-neutral-500">
        Опишите своими словами, что именно должен проверять тест
      </p>
    </div>

    <p
      v-if="!store.isStepValid"
      class="text-xs text-red-400"
    >
      Добавьте текст или загрузите файл
    </p>
  </div>
</template>
