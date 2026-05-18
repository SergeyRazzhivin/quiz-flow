// pricingComponents.test.ts
// Behavior tests for PricingCards (period toggle, copy) and ProStatusBanner
// (ru-RU date format, renew CTA) — plan 05-03 Task 2.

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const createPaymentMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: { rpc: vi.fn(), auth: { getSession: vi.fn() } },
}))
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@features/auth/model/useAuthStore', () => ({
  useAuthStore: () => ({ user: { id: 'owner-1' } }),
}))
vi.mock('../model/usePaymentStore', () => ({
  usePaymentStore: () => ({ createPayment: createPaymentMock }),
}))

import PricingCards from './PricingCards.vue'
import ProStatusBanner from './ProStatusBanner.vue'

const freeUsage = {
  plan: 'free' as const,
  quizzes_used: 2, quizzes_limit: 3,
  ai_used: 4, ai_limit: 10, period_end: null, current_period: null,
}

describe('PricingCards', () => {
  it('renders Free and Pro plan titles with feature copy', () => {
    setActivePinia(createPinia())
    const wrapper = mount(PricingCards, { props: { usage: freeUsage, loading: false } })
    const text = wrapper.text()
    expect(text).toContain('Free')
    expect(text).toContain('Pro')
    expect(text).toContain('AI-генераций')
    expect(text).toContain('Подписаться')
  })

  it('toggles the Pro price between monthly 490 and yearly 4 490', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(PricingCards, { props: { usage: freeUsage, loading: false } })
    expect(wrapper.text()).toContain('490')
    const yearlyBtn = wrapper.findAll('button').find(b => b.text().includes('Ежегодно'))
    expect(yearlyBtn).toBeTruthy()
    await yearlyBtn!.trigger('click')
    expect(wrapper.text()).toContain('4 490')
    expect(wrapper.text()).toContain('Скидка 24%')
  })

  it('shows "Текущий план" on the Free card for a free user', () => {
    setActivePinia(createPinia())
    const wrapper = mount(PricingCards, { props: { usage: freeUsage, loading: false } })
    expect(wrapper.text()).toContain('Текущий план')
  })

  it('calls createPayment with the selected period on Подписаться click', async () => {
    setActivePinia(createPinia())
    createPaymentMock.mockReset()
    const wrapper = mount(PricingCards, { props: { usage: freeUsage, loading: false } })
    const cta = wrapper.findAll('button').find(b => b.text().includes('Подписаться'))
    await cta!.trigger('click')
    expect(createPaymentMock).toHaveBeenCalledWith('monthly')
  })

  it('shows the loading CTA copy while loading', () => {
    setActivePinia(createPinia())
    const wrapper = mount(PricingCards, { props: { usage: freeUsage, loading: true } })
    expect(wrapper.text()).toContain('Переходим к оплате…')
  })
})

describe('ProStatusBanner', () => {
  it('formats period_end with the ru-RU locale and shows the renew CTA', () => {
    setActivePinia(createPinia())
    const periodEnd = '2026-12-31T00:00:00Z'
    const usage = { ...freeUsage, plan: 'pro' as const, period_end: periodEnd }
    const wrapper = mount(ProStatusBanner, { props: { usage } })
    const text = wrapper.text()
    expect(text).toContain('Pro активен')
    expect(text).toContain(new Date(periodEnd).toLocaleDateString('ru-RU'))
    expect(text).toContain('Продлить подписку')
  })

  it('calls createPayment when the renew button is clicked', async () => {
    setActivePinia(createPinia())
    createPaymentMock.mockReset()
    const usage = { ...freeUsage, plan: 'pro' as const, period_end: '2026-12-31T00:00:00Z' }
    const wrapper = mount(ProStatusBanner, { props: { usage } })
    await wrapper.find('button').trigger('click')
    expect(createPaymentMock).toHaveBeenCalled()
  })
})
