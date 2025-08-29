/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: [
      '.ngrok.io',
      '.ngrok-free.app',
      'localhost'
    ]
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64x64.png', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Vinyl Companion',
        short_name: 'Vinyl',
        description: 'Personal vinyl record collection tracker with automatic album identification',
        theme_color: '#1f2937',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB to handle OpenCV.js bundle
        runtimeCaching: [
          // API responses cache with network-first strategy for fresh data when online
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              networkTimeoutSeconds: 3
            }
          },
          // MusicBrainz API cache
          {
            urlPattern: /^https:\/\/musicbrainz\.org\/ws\/2\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'musicbrainz-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          // Discogs API cache
          {
            urlPattern: /^https:\/\/api\.discogs\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'discogs-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          // Cover Art Archive images
          {
            urlPattern: /^https:\/\/coverartarchive\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cover-art-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              }
            }
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true
  }
})
