// NexttGen ERP — frontend-only demo. No backend, no API proxy.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves the app from /<repo-name>/ — the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { port: 5173, open: false },
})
