import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only CORS proxy plugin — proxies /cors-proxy/?<encoded-url> to the target
function corsProxy() {
  return {
    name: 'cors-proxy',
    configureServer(server) {
      server.middlewares.use('/cors-proxy', async (req, res) => {
        const encoded = req.url.startsWith('/?') ? req.url.slice(2) : req.url.slice(1);
        const targetUrl = decodeURIComponent(encoded);
        if (!targetUrl.startsWith('http')) {
          res.statusCode = 400;
          res.end('Invalid URL');
          return;
        }
        try {
          const response = await fetch(targetUrl);
          if (!response.ok) { res.statusCode = response.status; res.end(); return; }
          res.setHeader('Access-Control-Allow-Origin', '*');
          const ct = response.headers.get('content-type');
          if (ct) res.setHeader('Content-Type', ct);
          const buffer = Buffer.from(await response.arrayBuffer());
          res.end(buffer);
        } catch (e) {
          res.statusCode = 502;
          res.end('Proxy error');
        }
      });
    }
  };
}

export default defineConfig({
  base: '/oam-vibe/',
  plugins: [react(), corsProxy()],
  server: {
    proxy: {
      // PROXY: Target the HOT OSM TiTiler instance
      '/titiler': {
        target: 'https://titiler.hotosm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/titiler/, '')
      }
    }
  }
})