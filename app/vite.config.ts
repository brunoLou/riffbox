import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // New versions install in the background and take over on next launch.
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-48.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'RIFFBOX',
        short_name: 'RIFFBOX',
        description: 'La boîte à outils du guitariste : accordeur, métronome, carnet d’idées, grilles, gammes et prompteur de scène.',
        lang: 'fr',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#11100f',
        theme_color: '#1a1816',
        categories: ['music', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Accordeur', url: './#/accordeur', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Métronome', url: './#/metronome', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Nouvelle idée', url: './#/idee', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Everything the app needs is precached, so it works fully offline.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
