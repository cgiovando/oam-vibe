import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/oam-vibe/', 
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.openaerialmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      // PROXY: Target the HOT OSM TiTiler instance
      '/titiler': {
        target: 'https://titiler.hotosm.org', 
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/titiler/, '')
      }
    }
  }
})