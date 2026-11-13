import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

/** 后端服务地址：开发与预览都由 Vite 代理 /api，前端只请求同源路径 */
const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:8787'

const apiProxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
  },
}

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts', 'src/stores/**/*.ts', 'server/**/*.ts'],
    },
  },
})
