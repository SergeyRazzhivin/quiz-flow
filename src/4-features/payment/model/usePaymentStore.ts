// src/4-features/payment/model/usePaymentStore.ts
// Owner-facing Pinia store for billing: usage data, the YooKassa payment
// redirect, and the freemium limit-error upsell handler.
// FSD: 4-features — imports from 5-entities and 6-shared only.
// The `useAuthStore` import is the allowed cross-feature exception (auth is a
// foundational feature consumed app-wide, e.g. by AppHeader).

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { supabase } from '@shared/api/supabase'
import { useAuthStore } from '@features/auth/model/useAuthStore'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@shared/config/env'

// --- Domain types -----------------------------------------------------------

/** Shape returned by the get_usage RPC (migration 015, D-13). */
export interface UsageData {
  plan: 'free' | 'pro'
  quizzes_used: number
  quizzes_limit: number | null
  ai_used: number
  ai_limit: number
  period_end: string | null
}

export type BillingPeriod = 'monthly' | 'yearly'

// Literal limit tokens raised by the DB triggers / AI Edge Function gate.
// The frontend matches these to route the user to the Pro upsell (D-18).
const LIMIT_MESSAGES: Record<string, string> = {
  QUIZ_LIMIT_EXCEEDED: 'Достигнут лимит тестов Free-плана.',
  QUESTION_LIMIT_EXCEEDED: 'Достигнут лимит вопросов Free-плана (10).',
  AI_LIMIT_EXCEEDED: 'Достигнут лимит AI-генераций (10/мес).',
}

// --- Store ------------------------------------------------------------------

export const usePaymentStore = defineStore('payment', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const authStore = useAuthStore()
  const router = useRouter()

  const usage = ref<UsageData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * isProActive: true only when the plan is 'pro' AND period_end is a future
   * date. A stale Pro row whose period has expired must not show as active
   * (mirrors the DB lazy-by-date resolution, D-05).
   */
  const isProActive = computed<boolean>(() => {
    if (!usage.value || usage.value.plan !== 'pro' || !usage.value.period_end) return false
    return new Date(usage.value.period_end).getTime() > Date.now()
  })

  /**
   * Load the owner's usage snapshot via the get_usage RPC.
   * A failed RPC (network/RLS) must NOT silently downgrade to free — surface
   * the error to the user instead of presenting a misleading Free view.
   */
  async function fetchUsage(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcError } = await (supabase as any).rpc('get_usage')
      if (rpcError) throw rpcError
      usage.value = data as UsageData
    } catch (e) {
      console.error('fetchUsage failed', e)
      error.value = 'Не удалось загрузить данные тарифа.'
      toast.error('Не удалось загрузить данные тарифа.')
    } finally {
      loading.value = false
    }
  }

  /**
   * Start the YooKassa flow: POST to the create-payment Edge Function with the
   * session JWT, then redirect the browser to the hosted confirmation_url
   * (D-01). The EF resolves the trusted user.id server-side.
   */
  async function createPayment(period: BillingPeriod): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('No active session')

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ period }),
      })
      if (!res.ok) throw new Error('create-payment responded non-ok')

      const { confirmation_url } = await res.json()
      if (!confirmation_url) throw new Error('Missing confirmation_url')

      // Redirect out to the YooKassa hosted payment page.
      window.location.href = confirmation_url as string
    } catch (e) {
      console.error('createPayment failed', e)
      toast.error('Не удалось создать платёж. Попробуйте позже.')
    }
  }

  /**
   * Inspect a caught error for one of the three literal limit tokens raised by
   * the DB triggers / AI gate. On a match, shows an upsell toast with a
   * 'Перейти на Pro' action routing to /billing and returns true (D-18).
   * Returns false for unrelated errors so the caller can handle them normally.
   */
  function handleLimitError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err)
    for (const [token, copy] of Object.entries(LIMIT_MESSAGES)) {
      if (message.includes(token)) {
        toast.error(copy, {
          action: {
            label: 'Перейти на Pro',
            onClick: () => { void router.push('/billing') },
          },
        })
        return true
      }
    }
    return false
  }

  function $reset(): void {
    usage.value = null
    loading.value = false
    error.value = null
  }

  return { usage, loading, error, isProActive, fetchUsage, createPayment, handleLimitError, $reset }
})
