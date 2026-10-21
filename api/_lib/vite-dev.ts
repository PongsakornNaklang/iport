/**
 * Vite plugin that serves `api/<name>.ts` during `vite dev`, so the Library
 * panel's YouTube search / feed proxy / … work locally without `vercel dev`.
 *
 *   // vite.config.ts
 *   import { apiDevServer } from './api/_lib/vite-dev';
 *   plugins: [react(), apiDevServer()],
 */
import type { Plugin } from 'vite';

export function apiDevServer(): Plugin {
  return {
    name: 'iport-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/([a-z0-9-]+)\/?(\?.*)?$/i.exec(req.url ?? '');
        if (!m) return next();
        try {
          const mod = (await server.ssrLoadModule(`/api/${m[1]}.ts`)) as Record<string, unknown>;
          const handler = mod[(req.method ?? 'GET').toUpperCase()];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            res.end('Method not allowed');
            return;
          }
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, { method: req.method, headers });
          const response = (await (handler as (r: Request) => Promise<Response>)(request)) as Response;
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          if (e instanceof Error && /Failed to load url|does not exist/i.test(e.message)) {
            res.statusCode = 404;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: `No API function named “${m[1]}”.` }));
            return;
          }
          next(e);
        }
      });
    },
  };
}
