import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sync-dist-to-root',
      closeBundle() {
        try {
          const src = path.resolve(__dirname, 'dist')
          const dest = path.resolve(__dirname, '../dist')
          fs.cpSync(src, dest, { recursive: true })
          console.log('✓ Successfully synced build output to root dist directory')
        } catch (e) {
          console.warn('Could not sync dist to root:', e.message)
        }
      },
    },
  ],
})
