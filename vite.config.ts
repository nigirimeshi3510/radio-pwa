import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/radio-pwa/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Radio Desk',
        short_name: 'Radio Desk',
        description: '公開MP3リンクをローカル保存して流せる個人用ラジオPWA',
        start_url: '/',
        display: 'standalone',
        background_color: '#f4efe6',
        theme_color: '#f4efe6',
        lang: 'ja',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.toLowerCase().endsWith('.mp3'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
}));
