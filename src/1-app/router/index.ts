import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@features/auth/model/useAuthStore'

// WR-07: typed route meta so `meta.requiresAuth` is checked, not `any`.
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                    component: () => import('@pages/LandingPage.vue') },
    { path: '/quizzes',             component: () => import('@pages/QuizListPage.vue') },
    { path: '/auth',                component: () => import('@pages/AuthPage.vue') },
    // WR-07: auth requirement is declared per-route via meta, not by textual
    // path-prefix matching — a path-prefix guard would also catch unrelated
    // future routes like /myaccount or /editorial.
    { path: '/my',                  component: () => import('@pages/MyQuizListPage.vue'),    meta: { requiresAuth: true } },
    { path: '/editor/:id',          component: () => import('@pages/QuizEditorPage.vue'),    meta: { requiresAuth: true } },
    { path: '/quiz/:id/stats',      component: () => import('@pages/QuizStatsPage.vue'),     meta: { requiresAuth: true } },
    { path: '/ai-wizard',           component: () => import('@pages/AiWizardPage.vue'),      meta: { requiresAuth: true } },
    { path: '/billing',             component: () => import('@pages/BillingPage.vue'),       meta: { requiresAuth: true } },
    // Public guest routes — no auth guard, access independent of is_published (D-19)
    { path: '/q/:token',            component: () => import('@pages/QuizSharePage.vue') },
    { path: '/q/:token/result',     component: () => import('@pages/QuizResultPage.vue') },
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.init()
  const requiresAuth = to.matched.some(r => r.meta.requiresAuth)
  if (requiresAuth && !authStore.user) {
    return { path: '/auth', query: { returnUrl: to.fullPath } }
  }
})
