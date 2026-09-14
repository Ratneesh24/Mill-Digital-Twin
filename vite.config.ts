import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // TypeScript FIRST. Vite's default order is ['.mjs', '.js', '.mts', '.ts',
    // '.jsx', '.tsx', ...], which puts `.js` ahead of `.tsx` — and `src/` is
    // littered with 89 stale compiled `.js` files, one shadowing every single
    // source module. With the default order an import of './KPIBar' resolved to
    // the stale KPIBar.js, so the dev server served compiled output from an old
    // build and no edit to a .tsx file had any effect on screen.
    // Both tsconfigs set noEmit, so nothing regenerates them; they are safe to
    // delete, and this ordering makes the source authoritative either way.
    extensions: ['.tsx', '.ts', '.jsx', '.mjs', '.js', '.mts', '.json'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Split the two heavy vendors out of the app bundle. On a control-room
        // screen that reloads rarely but is redeployed often, this keeps the
        // three.js and charting payloads cached across app updates.
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          charts: ['recharts'],
        },
      },
    },
  },
})
