import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/bedtime-bonanza/',
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
