import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // Ajoute cette ligne

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})