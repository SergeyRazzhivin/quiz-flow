import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { User } from '@supabase/supabase-js'

// vi.mock is hoisted to the top of the file by vitest.
// The factory must be self-contained (no references to outer variables).
vi.mock('@shared/api/supabase', () => {
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()
  const mockSignInWithPassword = vi.fn()
  const mockSignUp = vi.fn()
  const mockSignOut = vi.fn()

  return {
    supabase: {
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: mockSignOut,
      },
    },
  }
})

// Import the mocked module to access its mock functions
import { supabase } from '@shared/api/supabase'
import { useAuthStore } from './useAuthStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Default: no session
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    })
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn(), id: 'sub-1', callback: vi.fn() } },
    })
  })

  it('init() sets user from getSession() and subscribes to onAuthStateChange', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' } as User
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as import('@supabase/supabase-js').Session },
      error: null,
    })

    const authStore = useAuthStore()
    expect(authStore.isLoading).toBe(true)

    await authStore.init()

    expect(supabase.auth.getSession).toHaveBeenCalledOnce()
    expect(authStore.user).toEqual(mockUser)
    expect(authStore.isLoading).toBe(false)
    expect(supabase.auth.onAuthStateChange).toHaveBeenCalledOnce()
  })

  it('login() calls supabase.auth.signInWithPassword and throws on error', async () => {
    const mockError = { message: 'Invalid credentials', status: 400 } as import('@supabase/supabase-js').AuthError
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: mockError,
    })

    const authStore = useAuthStore()

    await expect(authStore.login('bad@example.com', 'wrongpass')).rejects.toMatchObject({
      message: 'Invalid credentials',
    })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'bad@example.com',
      password: 'wrongpass',
    })
  })

  it('register() calls supabase.auth.signUp and throws on error', async () => {
    const mockError = { message: 'Email already in use', status: 422 } as import('@supabase/supabase-js').AuthError
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: mockError,
    })

    const authStore = useAuthStore()

    await expect(authStore.register('existing@example.com', 'password123')).rejects.toMatchObject({
      message: 'Email already in use',
    })
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'existing@example.com',
      password: 'password123',
    })
  })

  it('logout() calls supabase.auth.signOut and clears user', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' } as User
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } as import('@supabase/supabase-js').Session },
      error: null,
    })
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })

    const authStore = useAuthStore()
    await authStore.init()
    expect(authStore.user).toEqual(mockUser)

    await authStore.logout()

    expect(supabase.auth.signOut).toHaveBeenCalledOnce()
    expect(authStore.user).toBeNull()
  })
})
