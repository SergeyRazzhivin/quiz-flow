<script setup lang="ts">
const steps = [
  {
    title: 'Загрузи текст',
    body: 'Скопируй материал или загрузи файл PDF/DOCX — любой объём',
  },
  {
    title: 'AI создаёт тест',
    body: 'Нейросеть за секунды генерирует вопросы с вариантами ответов',
  },
  {
    title: 'Поделись и проверяй',
    body: 'Отправь ссылку участникам и сразу смотри результаты',
  },
]
</script>

<template>
  <section class="bg-neutral-900/50 py-12">
    <div class="mx-auto max-w-6xl px-6">
      <h2 class="mb-8 text-xl font-semibold text-neutral-50">
        Как это работает
      </h2>
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div
          v-for="(step, index) in steps"
          :key="step.title"
          class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
        >
          <div class="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-indigo-600 text-sm font-semibold text-white">
            {{ index + 1 }}
          </div>
          <h3 class="mb-2 text-base font-semibold text-neutral-50">
            {{ step.title }}
          </h3>
          <p class="text-sm leading-relaxed text-neutral-400">
            {{ step.body }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
