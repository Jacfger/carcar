import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['matter-js'],
  },
})
