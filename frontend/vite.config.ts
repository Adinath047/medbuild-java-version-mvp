import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectManifest: undefined,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/super-admin/, /^\/api/],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Medbuild EMR',
        short_name: 'Medbuild',
        description: 'Offline-first hospital EMR system',
        theme_color: '#1d4ed8',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  build: {
    outDir: '../src/main/resources/static',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-db': ['dexie'],
          'vendor-pdf': ['jspdf', 'html2canvas', 'dompurify'],
          'vendor-utils': ['axios', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true, ws: true } },
  },
});
