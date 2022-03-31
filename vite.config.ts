import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

import visualizer from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'

const pathSrc = resolve(__dirname, './src')

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue']
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    visualizer({
      filename: './node_modules/.cache/visualizer/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
    viteCompression()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  base: './',
  server: {
    cors: true, // 允许跨域
    // 设置代理
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/', '/api/')
      }
    }
  },
  css: {
    preprocessorOptions: {
      stylus: {
        // additionalData: `@import "${pathSrc}/styles/index.styl";`,
        imports: [resolve(__dirname, 'src/style/index')]
      },
    }
  }
})
