import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const androidBuild = process.env.HUIXIN_ANDROID === '1';
const base = process.env.HUIXIN_BASE_PATH || '/';
export default defineConfig({
  base,
  // Build tag lets the PWA update test deploy two distinguishable versions.
  define: { __BUILD_TAG__: JSON.stringify(process.env.HUIXIN_BUILD_TAG || ''), __ANDROID_APP__: JSON.stringify(androidBuild) },
  plugins: [react(), VitePWA({
    disable: androidBuild,
    registerType: 'prompt',
    injectRegister: 'script-defer',
    includeAssets: ['favicon.svg', 'icons/*.png', 'images/*.webp'],
    manifest: {
      name: '会心馆',
      short_name: '会心馆',
      description: '会于心者，藏于此间。私人兴趣与审美收藏馆。',
      theme_color: '#f7f4ee',
      background_color: '#f7f4ee',
      display: 'standalone',
      start_url: base,
      scope: base,
      icons: [
        { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${base}icons/icon-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      navigateFallback: `${base}index.html`,
      cleanupOutdatedCaches: true,
    },
  })],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
