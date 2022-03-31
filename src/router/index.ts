import {
  createRouter,
  createWebHashHistory,
  RouteRecordRaw,
} from 'vue-router'

import { defineAsyncComponent } from 'vue'
import Home from '@/views/Home/index.vue'
import Other from '@/views/Other/index.vue'
import Write from '@/views/Write/index.vue'

// 路由懒加载
const _import = (path) => defineAsyncComponent(() => import(`../views/${path}/index.vue`))

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Other',
    component: Other,
  },
  {
    path: '/:catchAll(.*)',
    component: Other,
  },
  {
    path: '/other',
    name: 'Other',
    component: Other
  },
  {
    path: '/write',
    name: 'Write',
    component: Write
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
