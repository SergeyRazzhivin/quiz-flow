import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@features/auth/model/useAuthStore'

const PROTECTED_ROUTES = ['/my', '/editor']

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',           component: () => import('@pages/QuizListPage.vue') },
    { path: '/auth',       component: () => import('@pages/AuthPage.vue') },
    { path: '/my',         component: () => import('@pages/MyQuizListPage.vue') },
    { path: '/editor/:id', component: () => import('@pages/QuizEditorPage.vue') },
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const requiresAuth = PROTECTED_ROUTES.some(r => to.path.startsWith(r))
  if (requiresAuth && !authStore.user) {
    return { path: '/auth', query: { returnUrl: to.fullPath } }
  }
})
