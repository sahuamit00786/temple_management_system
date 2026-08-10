import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/diya.svg'],
      manifest: {
        name: 'TMADJ Temple Management',
        short_name: 'TMADJ',
        description: 'Temple POS, donations, hall bookings and reports - works offline',
        theme_color: '#5C1A1B',
        background_color: '#FBF6EC',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Cache every GET API response — NetworkFirst so fresh data always preferred,
            // cached copy returned instantly when offline. Covers all pages automatically.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/v1/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tmadj-api-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            }
          },
          {
            urlPattern: /\/uploads\//,
            handler: 'CacheFirst',
            options: { cacheName: 'tmadj-uploads', expiration: { maxEntries: 30 } }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000'
    }
  }
});
