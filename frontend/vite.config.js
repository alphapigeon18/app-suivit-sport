import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // En local : base '/'. Sur GitHub Pages, le workflow définit
  // DEPLOY_BASE=/app-suivit-sport/ car le site est servi sous ce chemin.
  base: process.env.DEPLOY_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
