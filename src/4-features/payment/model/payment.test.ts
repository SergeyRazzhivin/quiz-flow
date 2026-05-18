// payment.test.ts
// Unit tests for usePaymentStore: fetchUsage RPC, isProActive computed,
// createPayment redirect, and the limit-error upsell handler (plan 05-03 Task 1).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Module mocks ──────────────────────────────────────────────────────────────
const rpcMock = vi.fn()
const getSessionMock = vi.fn()
const toastErrorMock = vi.fn()
const routerPushMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpcMock(...a),
    auth: { getSession: (...a: unknown[]) => getSessionMock(...a) },
  },
}))

vi.mock('vue-sonner', () => ({
  toast: { error: (...a: unknown[]) => toastErrorMock(...a) },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: (...a: unknown[]) => routerPushMock(...a) }),
}))

vi.mock('@features/auth/model/useAuthStore', () => ({
  useAuthStore: () => ({ user: { id: 'owner-1' } }),
}))

import { usePaymentStore } from './usePaymentStore'

const futureDate = new Date(Date.now() + 30 * 86400_000).toISOString()
const pastDate = new Date(Date.now() - 86400_000).toISOString()

beforeEach(() => {
  setActivePinia(createPinia())
  rpcMock.mockReset()
  getSessionMock.mockReset()
  toastErrorMock.mockReset()
  routerPushMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePaymentStore.fetchUsage', () => {
  it('sets usage on a successful get_usage RPC call', async () => {
    const payload = {
      plan: 'free', quizzes_used: 2, quizzes_limit: 3,
      ai_used: 4, ai_limit: 10, period_end: null,
    }
    rpcMock.mockResolvedValue({ data: payload, error: null })
    const store = usePaymentStore()
    await store.fetchUsage()
    expect(rpcMock).toHaveBeenCalledWith('get_usage')
    expect(store.usage).toEqual(payload)
    expect(store.error).toBeNull()
  })

  it('sets error and shows a toast on RPC error, without downgrading to free', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('rpc failed') })
    const store = usePaymentStore()
    await store.fetchUsage()
    expect(store.error).not.toBeNull()
    expect(store.usage).toBeNull()
    expect(toastErrorMock).toHaveBeenCalled()
  })
})

describe('usePaymentStore.isProActive', () => {
  it('is true when plan is pro and period_end is in the future', async () => {
    rpcMock.mockResolvedValue({
      data: { plan: 'pro', quizzes_used: 0, quizzes_limit: null, ai_used: 0, ai_limit: 30, period_end: futureDate },
      error: null,
    })
    const store = usePaymentStore()
    await store.fetchUsage()
    expect(store.isProActive).toBe(true)
  })

  it('is false when plan is pro but period_end has expired', async () => {
    rpcMock.mockResolvedValue({
      data: { plan: 'pro', quizzes_used: 0, quizzes_limit: null, ai_used: 0, ai_limit: 30, period_end: pastDate },
      error: null,
    })
    const store = usePaymentStore()
    await store.fetchUsage()
    expect(store.isProActive).toBe(false)
  })

  it('is false for a free plan', async () => {
    rpcMock.mockResolvedValue({
      data: { plan: 'free', quizzes_used: 0, quizzes_limit: 3, ai_used: 0, ai_limit: 10, period_end: null },
      error: null,
    })
    const store = usePaymentStore()
    await store.fetchUsage()
    expect(store.isProActive).toBe(false)
  })
})

describe('usePaymentStore.createPayment', () => {
  it('redirects to the confirmation_url returned by create-payment', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok-1' } } })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ confirmation_url: 'https://yookassa.test/pay', payment_id: 'pay-1' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const locationStub = { href: '' }
    vi.stubGlobal('location', locationStub)

    const store = usePaymentStore()
    await store.createPayment('monthly')

    expect(fetchMock).toHaveBeenCalled()
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer tok-1')
    expect(JSON.parse(init.body)).toEqual({ period: 'monthly' })
    expect(locationStub.href).toBe('https://yookassa.test/pay')
  })

  it('shows an error toast when create-payment responds non-ok', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok-1' } } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))

    const store = usePaymentStore()
    await store.createPayment('yearly')
    expect(toastErrorMock).toHaveBeenCalled()
  })
})

describe('usePaymentStore.handleLimitError', () => {
  it.each([
    'QUIZ_LIMIT_EXCEEDED',
    'QUESTION_LIMIT_EXCEEDED',
    'AI_LIMIT_EXCEEDED',
  ])('returns true and shows an upsell toast for %s', (token) => {
    const store = usePaymentStore()
    const handled = store.handleLimitError(new Error(`pg error: ${token}`))
    expect(handled).toBe(true)
    expect(toastErrorMock).toHaveBeenCalled()
    const [, opts] = toastErrorMock.mock.calls[0]
    expect(opts.action.label).toBe('Перейти на Pro')
    opts.action.onClick()
    expect(routerPushMock).toHaveBeenCalledWith('/billing')
  })

  it('returns false for an unrelated error', () => {
    const store = usePaymentStore()
    const handled = store.handleLimitError(new Error('network down'))
    expect(handled).toBe(false)
  })
})
