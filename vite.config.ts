import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  // Le proxy de développement cible le port de l'API (variable PORT, éventuellement définie dans .env).
  const env = loadEnv(mode, process.cwd(), '')
  const api = `http://localhost:${env.PORT || '3000'}`
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: { '/api': api, '/uploads': api },
    },
    build: {
      chunkSizeWarningLimit: 1500,
    },
  }
})
