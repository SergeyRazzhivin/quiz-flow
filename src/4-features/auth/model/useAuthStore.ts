import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@shared/api/supabase'
import type { User } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoading = ref(true)
  let initPromise: Promise<void> | null = null

  // Idempotent — awaited by the router guard so the session is resolved
  // before any protected-route check runs.
  function init(): Promise<void> {
    if (initPromise) return initPromise
    initPromise = (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      user.value = session?.user ?? null
      isLoading.value = false

      supabase.auth.onAuthStateChange((_event, session) => {
        user.value = session?.user ?? null
      })
    })()
    return initPromise
  }

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function register(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
  }

  async function requestPasswordReset(email: string): Promise<void> {
    // LOCKED redirect derivation (07-CONTEXT.md Supabase Flow): origin + BASE_URL + 'reset-password'
    // works on both GitHub Pages (/quiz-flow/reset-password) and local dev (/reset-password).
    const redirectTo = window.location.origin + import.meta.env.BASE_URL + 'reset-password'
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    // CONTEXT.md Email Security LOCKED: never reveal whether an email is registered —
    // swallow all Supabase errors so the UI always shows the generic success message.
    if (error) {
      console.warn('[auth] resetPasswordForEmail error', error.message)
    }
  }

  async function updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  return { user, isLoading, init, login, register, logout, requestPasswordReset, updatePassword }
})
