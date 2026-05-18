<script setup lang="ts">
const steps = [
  {
    title: 'Загрузи текст',
    body: 'Скопируй учебный материал, конспект или статью — либо просто загрузи файл PDF или DOCX. Объём не ограничен: нейросеть сама выделит главное и отбросит лишнее.',
  },
  {
    title: 'AI создаёт тест',
    body: 'За несколько секунд нейросеть формирует вопросы с вариантами ответов и отмечает правильные. Ты задаёшь количество вопросов, сложность и тему — остальное берёт на себя AI.',
  },
  {
    title: 'Поделись и проверяй',
    body: 'Отправь участникам персональную ссылку доступа и наблюдай за прохождением. Результаты, баллы и статистика по каждому вопросу появляются автоматически.',
  },
]
</script>

<template>
  <section class="py-8">
    <div class="mx-auto max-w-6xl px-6">
      <h2 class="text-xl font-semibold text-neutral-50">
        Как это работает
      </h2>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
        Три простых шага от исходного материала до готового теста, который можно
        отправить участникам. Никакой ручной вёрстки вопросов и проверки ответов.
      </p>
      <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
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
      <p class="mt-8 text-sm text-neutral-500">
        В среднем создание теста занимает меньше минуты — от вставки текста до готовой ссылки.
      </p>
    </div>
  </section>
</template>
