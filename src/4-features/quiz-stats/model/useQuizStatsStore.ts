// src/4-features/quiz-stats/model/useQuizStatsStore.ts
// Owner-facing Pinia store for quiz statistics.
// FSD: 4-features — imports from 5-entities and 6-shared only.

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { supabase } from '@shared/api/supabase'
import { useAuthStore } from '@features/auth/model/useAuthStore'

// --- Domain types -----------------------------------------------------------

export interface PerPersonRow {
  quiz_access_id: string
  name: string | null
  score: number | null
  finished_at: string
}

export interface AccuracyRow {
  question_id: string
  body: string
  order_index: number
  accuracy_percent: number | null
}

export interface QuizStats {
  totalAttempts: number
  finishedCount: number
  avgScore: number | null
  totalQuestions: number
  perPerson: PerPersonRow[]
}

// --- Store ------------------------------------------------------------------

export const useQuizStatsStore = defineStore('quiz-stats', () => {
  const authStore = useAuthStore()

  const stats    = ref<QuizStats | null>(null)
  const accuracy = ref<AccuracyRow[] | null>(null)
  const isPro    = ref(false)
  const isLoading = ref(false)
  const error    = ref<string | null>(null)

  /** D-05: Derive Pro status from the real subscriptions table. A null row is treated as Free (Pitfall 5). */
  async function loadProStatus(): Promise<void> {
    if (!authStore.user) {
      isPro.value = false
      return
    }
    const { data, error: subError } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', authStore.user.id)
      .maybeSingle()
    // WR-04: a failed query (network/RLS) must NOT silently downgrade a Pro
    // owner to Free — surface it to the outer catch instead of swallowing.
    if (subError) throw subError
    // Pitfall 5: optional chaining handles null row without error
    isPro.value = data?.plan === 'pro' && data?.status === 'active'
  }

  /**
   * Load stats for the given quizId.
   * D-06: get_quiz_accuracy is NEVER called for Free owners.
   */
  async function loadStats(quizId: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await loadProStatus()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: statsData, error: statsError } = await (supabase as any).rpc('get_quiz_stats', {
        p_quiz_id: quizId,
      })
      if (statsError) throw statsError
      // CR-02: defend against a SQL NULL perPerson (older payloads) so the
      // PerPersonRow[] contract always holds for consumers.
      const parsedStats = statsData as QuizStats
      stats.value = { ...parsedStats, perPerson: parsedStats.perPerson ?? [] }

      // D-06: accuracy fetched only for Pro owners
      if (isPro.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: accData, error: accError } = await (supabase as any).rpc('get_quiz_accuracy', {
          p_quiz_id: quizId,
        })
        if (accError) throw accError
        // CR-02: coalesce a SQL NULL accuracy payload to an empty array.
        accuracy.value = (accData as AccuracyRow[] | null) ?? []
      } else {
        accuracy.value = null
      }
    } catch (e) {
      // WR-05: keep the real error for diagnosability instead of discarding it.
      console.error('loadStats failed', e)
      error.value = 'Не удалось загрузить статистику. Проверьте подключение и попробуйте обновить страницу.'
      toast.error('Не удалось загрузить статистику. Проверьте подключение и попробуйте обновить страницу.')
    } finally {
      isLoading.value = false
    }
  }

  /** completionRate: 0 when no attempts, else round(finishedCount / totalAttempts * 100). */
  const completionRate = computed<number>(() => {
    if (!stats.value || stats.value.totalAttempts === 0) return 0
    return Math.round((stats.value.finishedCount / stats.value.totalAttempts) * 100)
  })

  function $reset(): void {
    stats.value    = null
    accuracy.value = null
    isPro.value    = false
    isLoading.value = false
    error.value    = null
  }

  return { stats, accuracy, isPro, isLoading, error, completionRate, loadStats, $reset }
})
