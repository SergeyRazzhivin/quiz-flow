<script setup lang="ts">
import { ref } from 'vue'
import { ImagePlus, Loader2, Camera } from 'lucide-vue-next'
import { useQuizEditorStore } from '@features/quiz-editor/model/useQuizEditorStore'
import Button from '@shared/ui/Button.vue'

const store = useQuizEditorStore()
const fileInput = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)

function openPicker() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) store.uploadCover(file)
  target.value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) store.uploadCover(file)
}
</script>

<template>
  <div class="w-full">
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="onFileChange"
    >

    <div v-if="store.quiz?.cover_url">
      <div class="group relative h-48 w-full">
        <img
          :src="store.quiz.cover_url"
          alt="Обложка теста"
          class="h-48 w-full rounded-lg object-cover"
        >
        <button
          type="button"
          class="absolute inset-0 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"
          @click="openPicker"
        >
          <Camera class="h-5 w-5" />
          Изменить
        </button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="mt-1 text-red-500 hover:bg-red-50 hover:text-red-600"
        @click="store.removeCover()"
      >
        Удалить обложку
      </Button>
    </div>

    <div
      v-else-if="store.isUploadingCover"
      class="flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white"
    >
      <Loader2 class="h-8 w-8 animate-spin text-gray-400" />
      <span class="mt-1 text-sm text-gray-400">Загружается...</span>
    </div>

    <div
      v-else
      class="flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-white transition-colors"
      :class="isDragOver ? 'border-violet-400 bg-violet-50' : 'border-gray-300'"
      @click="openPicker"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop="onDrop"
    >
      <ImagePlus class="h-8 w-8 text-gray-300" />
      <span class="mt-1 text-sm text-gray-400">
        {{ isDragOver ? 'Отпустите для загрузки' : 'Добавить обложку' }}
      </span>
    </div>
  </div>
</template>
