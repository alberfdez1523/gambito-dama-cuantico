import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const backendTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'apple-touch-icon.png',
        'brand/gambito-quantum-mark-dark.svg',
        'brand/gambito-quantum-mark-light.svg',
      ],
      manifest: {
        name: 'Academia Estratégica Cuántica',
        short_name: 'Gambito Cuántico',
        description: 'Academia bilingüe de ajedrez clásico y cuántico, disponible sin conexión.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0c10',
        theme_color: '#0b0c10',
        categories: ['education', 'games'],
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/brand/gambito-quantum-mark-dark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/music\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        runtimeCaching: [
          {
            urlPattern: /\/music\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'public-soundscapes-v1',
              expiration: { maxEntries: 12, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'db-tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': backendTarget,
      '/music': backendTarget,
    },
  },
  build: {
    outDir: 'dist',
  },
})
