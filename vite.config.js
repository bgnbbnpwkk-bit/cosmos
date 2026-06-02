import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

// Eindeutige ID pro Build – nur noch fuer den Uebergang aelterer Clients
// (die alte Version pollte version.json) auf die neue Service-Worker-Version.
const buildId = Date.now().toString()

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service Worker aktualisiert sich automatisch, ohne Neu-Installation.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Vorhandenes public/manifest.json weiterverwenden (nicht generieren).
      manifest: false,
      includeAssets: ['apple-touch-icon.png', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.json'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,ttf,json}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
    {
      // Schreibt version.json mit der Build-ID in den Build-Output.
      name: 'cosmos-version',
      closeBundle() {
        fs.writeFileSync(
          path.resolve(__dirname, 'dist/version.json'),
          JSON.stringify({ version: buildId })
        )
      },
    },
  ],
  base: '/cosmos/',
})
