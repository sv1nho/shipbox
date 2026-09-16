import { defineConfig, coverageConfigDefaults } from 'vitest/config'
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
      projects: [
        {
          extends: true,
          test: {
            name: 'client',
            environment: 'happy-dom',
            include: ['client/**/*.{test,spec}.{ts,tsx}'],
            setupFiles: ['client/__tests__/setup.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'server',
            environment: 'node',
            include: ['server/**/*.{test,spec}.ts', 'shared/**/*.{test,spec}.ts'],
            exclude: ['**/*.db.{test,spec}.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'db',
            environment: 'node',
            include: ['prisma/**/*.{test,spec}.ts', 'server/**/*.db.{test,spec}.ts'],
            globalSetup: ['prisma/__tests__/global-setup.ts'],
            setupFiles: ['prisma/__tests__/setup-test-database.ts'],
            fileParallelism: false,
          },
        },
      ],
      coverage: {
        reportsDirectory: 'coverage',
        include: [
          'client/api/**/*.ts',
          'client/shipments/**/*.{ts,tsx}',
          'client/utils/**/*.ts',
          'client/pages/Shipments.tsx',
          'server/**/*.ts',
          'shared/**/*.ts',
          // Add the label form, the layout and the auth pages once they have tests.
        ],
        exclude: [
          ...coverageConfigDefaults.exclude,
          'shared/label-payload.ts',
          'server/generated/**',
          'server/types/**',
          'server/index.ts',
          'server/prisma.ts',
          'server/prisma-client.ts',
          'server/services/shipments/types.ts',
          'server/env.ts',
          'server/auth/auth.ts',
          // Drop this entry once Supertest covers the routes.
          'server/app.ts',
        ],
      },
    },
  }
})
