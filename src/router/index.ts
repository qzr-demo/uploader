import {
  createRouter,
  createWebHashHistory,
  RouteRecordRaw,
} from 'vue-router'

import { defineAsyncComponent } from 'vue'
import webuploaderDemo from '@/views/WebuploaderDemo/index.vue'
import webuploaderDemo1 from '@/views/WebuploaderDemo1/index.vue'
import Write from '@/views/Write/index.vue'

// 路由懒加载
const _import = (path) => defineAsyncComponent(() => import(`../views/${path}/index.vue`))

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Other',
    component: Write,
  },
  {
    path: '/:catchAll(.*)',
    component: Write,
  },
  {
    path: '/webuploaderDemo1',
    name: 'WebuploaderDemo1',
    component: webuploaderDemo1
  },
  {
    path: '/webuploaderDemo',
    name: 'WebuploaderDemo',
    component: webuploaderDemo
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
