import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8000'
  const wsBackendUrl = backendUrl.replace(/^http/, 'ws')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
        '/auth': { target: backendUrl, changeOrigin: true },
        '/profile': { target: backendUrl, changeOrigin: true },
        '/fetch-jobs': { target: backendUrl, changeOrigin: true },
        '/jobs': { target: backendUrl, changeOrigin: true },
        '/generate-resume': { target: backendUrl, changeOrigin: true },
        '/apply': { target: backendUrl, changeOrigin: true },
        '/applications': { target: backendUrl, changeOrigin: true },
        '/logs': {
          target: wsBackendUrl,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
