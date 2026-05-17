import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@features/auth/model/useAuthStore'

const PROTECTED_ROUTES = ['/my', '/editor']

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                    component: () => import('@pages/QuizListPage.vue') },
    { path: '/auth',                component: () => import('@pages/AuthPage.vue') },
    { path: '/my',                  component: () => import('@pages/MyQuizListPage.vue') },
    { path: '/editor/:id',          component: () => import('@pages/QuizEditorPage.vue') },
    // Public guest routes — no auth guard, access independent of is_published (D-19)
    { path: '/q/:token',            component: () => import('@pages/QuizSharePage.vue') },
    { path: '/q/:token/result',     component: () => import('@pages/QuizResultPage.vue') },
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.init()
  const requiresAuth = PROTECTED_ROUTES.some(r => to.path.startsWith(r))
  if (requiresAuth && !authStore.user) {
    return { path: '/auth', query: { returnUrl: to.fullPath } }
  }
})
