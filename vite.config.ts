import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  root: 'dashboard',
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
      '/recordings': 'http://localhost:3001',
      '/screenshots': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'dashboard/src')
    }
  }
})
