import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.API_PORT || '3000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: false,
        },
      },
    },
    test: {
      environment: 'happy-dom',
      include: ['client/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        reportsDirectory: 'coverage',
      },
    },
  }
})
