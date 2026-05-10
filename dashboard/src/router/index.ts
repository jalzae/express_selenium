import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/Projects.vue')
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetail.vue')
  },
  {
    path: '/test-runs',
    name: 'TestRuns',
    component: () => import('../views/TestRuns.vue')
  },
  {
    path: '/test-runs/:id',
    name: 'TestRunDetail',
    component: () => import('../views/TestRunDetail.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
