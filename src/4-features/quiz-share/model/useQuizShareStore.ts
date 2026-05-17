// src/4-features/quiz-share/model/useQuizShareStore.ts
// Owner-facing store for access link CRUD.
// FSD: 4-features imports from 5-entities and 6-shared only — no feature-to-feature imports.

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { supabase } from '@shared/api/supabase'
import { fetchAccessLinks, deleteAccessLink } from '@entities/quiz-access/api'
import type { QuizAccess } from '@entities/quiz-access/model'

export const useQuizShareStore = defineStore('quiz-share', () => {
  const links = ref<QuizAccess[]>([])
  const isLoading = ref(false)
  const isCreating = ref(false)
  const lastCreated = ref<{ token: string; login: string; password: string } | null>(null)

  async function loadLinks(quizId: string) {
    isLoading.value = true
    try {
      links.value = await fetchAccessLinks(quizId)
    } catch {
      toast.error('Не удалось загрузить ссылки. Проверьте соединение.')
    } finally {
      isLoading.value = false
    }
  }

  async function createLink(quizId: string, label: string, expiresAt?: string) {
    if (!label.trim()) {
      toast.error('Укажите имя тестируемого.')
      return
    }
    isCreating.value = true
    try {
      // WR-01: the date <Input> yields a bare YYYY-MM-DD, which a timestamptz
      // column stores as 00:00:00 — the link would expire at the *start* of the
      // chosen day. Persist it as end-of-day so the link is valid through the
      // displayed "до DD.MM.YYYY" date (inclusive contract).
      const expiresAtEod = expiresAt ? `${expiresAt}T23:59:59` : undefined
      const { data, error } = await supabase.functions.invoke('create-quiz-access', {
        body: { quizId, label, expiresAt: expiresAtEod },
      })
      if (error) throw error
      // D-15: plaintext password stored in lastCreated only — never persisted
      lastCreated.value = data as { token: string; login: string; password: string }
      // CR-03: prepend the new link optimistically using the REAL row id returned
      // by create-quiz-access. Using token as the id would make removeLink() call
      // deleteAccessLink with the wrong identifier — the delete matches zero rows
      // and the link silently survives in the DB.
      links.value.unshift({
        id: data.id,
        quiz_id: quizId,
        token: data.token,
        login: data.login,
        label,
        // Mirror the end-of-day value actually persisted so the optimistic row
        // and a reloaded row agree (WR-01).
        expires_at: expiresAtEod ?? null,
      })
      toast.success('Ссылка создана.')
    } catch {
      toast.error('Ошибка создания ссылки. Попробуйте снова.')
    } finally {
      isCreating.value = false
    }
  }

  async function removeLink(id: string) {
    try {
      await deleteAccessLink(id)
      links.value = links.value.filter((l) => l.id !== id)
      toast.success('Ссылка удалена.')
    } catch {
      toast.error('Ошибка удаления ссылки.')
    }
  }

  return { links, isLoading, isCreating, lastCreated, loadLinks, createLink, removeLink }
})
