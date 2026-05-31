import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Eindeutige ID pro Build – dient als Versionsstempel fuer Auto-Updates.
const buildId = Date.now().toString()

export default defineConfig({
  plugins: [
    react(),
    {
      // Schreibt version.json mit derselben ID in den Build-Output.
      name: 'cosmos-version',
      closeBundle() {
        fs.writeFileSync(
          path.resolve(__dirname, 'dist/version.json'),
          JSON.stringify({ version: buildId })
        )
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  base: '/cosmos/',
})
