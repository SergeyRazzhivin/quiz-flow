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
  const mockResetPasswordForEmail = vi.fn()
  const mockUpdateUser = vi.fn()

  return {
    supabase: {
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: mockSignOut,
        resetPasswordForEmail: mockResetPasswordForEmail,
        updateUser: mockUpdateUser,
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

  // --- Phase 7: password recovery (AUTH-04 / AUTH-05 / AUTH-06) ---

  it('requestPasswordReset() calls supabase.auth.resetPasswordForEmail with redirectTo derived from BASE_URL', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.resetPasswordForEmail>>)

    const authStore = useAuthStore()

    await expect(authStore.requestPasswordReset('user@example.com')).resolves.toBeUndefined()

    // happy-dom default origin is http://localhost:3000, vitest BASE_URL resolves to '/'.
    // Assert via the live origin so the test stays portable across happy-dom versions.
    const expectedRedirect = `${window.location.origin}/reset-password`
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: expectedRedirect },
    )
  })

  it('requestPasswordReset() swallows the "User not found" Supabase error (no email enumeration)', async () => {
    const notFoundError = { message: 'User not found', status: 400 } as import('@supabase/supabase-js').AuthError
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: null,
      error: notFoundError,
    })

    const authStore = useAuthStore()

    // LOCKED: never reveal whether an email is registered — method MUST NOT throw.
    await expect(authStore.requestPasswordReset('ghost@example.com')).resolves.toBeUndefined()
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledOnce()
  })

  it('requestPasswordReset() swallows other Supabase errors (network / rate limit) for generic-success UX', async () => {
    const otherError = { message: 'Email rate limit exceeded', status: 429 } as import('@supabase/supabase-js').AuthError
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: null,
      error: otherError,
    })

    const authStore = useAuthStore()

    await expect(authStore.requestPasswordReset('rate@example.com')).resolves.toBeUndefined()
  })

  it('updatePassword() calls supabase.auth.updateUser and resolves on success', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' } as User
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.updateUser>>)

    const authStore = useAuthStore()

    await expect(authStore.updatePassword('newpassword123')).resolves.toBeUndefined()
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
  })

  it('updatePassword() throws when Supabase returns an error (e.g. password matches old one)', async () => {
    const mockError = {
      message: 'New password should be different from the old password',
      status: 422,
    } as import('@supabase/supabase-js').AuthError
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: mockError,
    } as Awaited<ReturnType<typeof supabase.auth.updateUser>>)

    const authStore = useAuthStore()

    await expect(authStore.updatePassword('oldpassword123')).rejects.toMatchObject({
      message: 'New password should be different from the old password',
    })
  })
})
