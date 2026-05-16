import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  resolve: {
    alias: {
      '@app':      fileURLToPath(new URL('./src/1-app', import.meta.url)),
      '@pages':    fileURLToPath(new URL('./src/2-pages', import.meta.url)),
      '@widgets':  fileURLToPath(new URL('./src/3-widgets', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/4-features', import.meta.url)),
      '@entities': fileURLToPath(new URL('./src/5-entities', import.meta.url)),
      '@shared':   fileURLToPath(new URL('./src/6-shared', import.meta.url)),
    }
  }
})
