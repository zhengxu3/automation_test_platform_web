import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', component: () => import('@/views/Login.vue') },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    children: [
      { path: '', redirect: '/requirements' },
      { path: 'requirements', component: () => import('@/views/RequirementList.vue') },
      { path: 'workspace/:reqId', component: () => import('@/views/Workspace.vue') },
      { path: 'goals', component: () => import('@/views/GoalList.vue') },
      { path: 'goal/:id', component: () => import('@/views/GoalDetail.vue') },
      { path: 'agents', component: () => import('@/views/AgentList.vue') },
      { path: 'repos', component: () => import('@/views/RepoList.vue') },
      { path: 'knowledge', component: () => import('@/views/KnowledgeList.vue') },
      { path: 'settings', component: () => import('@/views/Settings.vue') },
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

const AUTH_SITE = 'https://qbox.holla.cool'

router.beforeEach((to, _, next) => {
  // 从 URL 提取 token（老站授权回跳带回）
  const urlToken = to.query.token as string
  if (urlToken) {
    localStorage.setItem('ai_token', urlToken)
    const { token, ...rest } = to.query
    next({ path: to.path, query: rest, replace: true })
    return
  }

  const token = localStorage.getItem('ai_token')
  if (to.path !== '/login' && !token && import.meta.env.PROD) {
    // 直接跳老站后端接口（页面导航），oauth2-proxy 会自动处理认证
    const redirect = encodeURIComponent(window.location.origin + to.fullPath)
    window.location.href = `${AUTH_SITE}/prod-api/ai/auth/redirect_with_token?redirect=${redirect}`
    return
  }
  next()
})

export default router
