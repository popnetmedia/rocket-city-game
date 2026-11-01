import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Dev only: serve api/<name>.js the way Vercel does, so /api/whats-on and /api/traffic
 * answer on the dev server instead of 404ing. Each request loads the handler through
 * Vite's SSR loader, so edits to api/ are live without a restart. Production never
 * sees this: it is a serve-time plugin with no build hook.
 */
const devApi = () => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const m = /^\/api\/([a-z0-9-]+)(\?|$)/.exec(req.url || '');
      if (!m) return next();
      try {
        const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
        res.status = (c) => { res.statusCode = c; return res; };
        await mod.default(req, res);
      } catch (e) {
        res.statusCode = 500; res.end(String(e?.stack || e));
      }
    });
  },
});

export default defineConfig({
  plugins: [devApi()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
        playNyc: resolve(__dirname, 'play/nyc.html'),
        playAnaheim: resolve(__dirname, 'play/anaheim.html'),
        playMiami: resolve(__dirname, 'play/miami.html'),
        playOrlando: resolve(__dirname, 'play/orlando.html'),
        playNashville: resolve(__dirname, 'play/nashville.html'),
        playKnoxville: resolve(__dirname, 'play/knoxville.html'),
        playChattanooga: resolve(__dirname, 'play/chattanooga.html'),
        cityHuntsville: resolve(__dirname, 'huntsville.html'),
        cityChattanooga: resolve(__dirname, 'chattanooga.html'),
        cityKnoxville: resolve(__dirname, 'knoxville.html'),
        cityNashville: resolve(__dirname, 'nashville.html'),
        cityOrlando: resolve(__dirname, 'orlando.html'),
        cityMiami: resolve(__dirname, 'miami.html'),
        cityAnaheim: resolve(__dirname, 'anaheim.html'),
        cityNyc: resolve(__dirname, 'nyc.html'),
      },
    },
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
});
