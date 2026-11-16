import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractToken, tokenMatches } from './auth.js';
import { hookOutput } from './permissions.js';
import { isLoopback, pairPage } from './pair.js';

const PANEL_DIR = resolve(fileURLToPath(new URL('../../panel', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const MAX_BODY = 16 * 1024;

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('too-large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createServer({ token, bus, sessions, permissions, focus, media, pairing }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    // Página de emparejamiento: solo desde la propia PC (nunca por la red).
    if (req.method === 'GET' && url.pathname === '/pair') {
      if (!pairing || !isLoopback(req.socket.remoteAddress)) return json(404, { error: 'not-found' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(pairPage(pairing.urls(), pairing.usbUrl()));
    }

    // Los archivos del panel son públicos; los datos y los hooks piden token.
    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
      const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = normalize(join(PANEL_DIR, rel));
      if (!file.startsWith(PANEL_DIR)) return json(403, { error: 'forbidden' });
      try {
        const data = await readFile(file);
        res.writeHead(200, {
          'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        return res.end(data);
      } catch {
        return json(404, { error: 'not-found' });
      }
    }

    if (!tokenMatches(token, extractToken(req, url))) {
      return json(401, { error: 'token-invalido' });
    }

    if (req.method === 'GET' && url.pathname === '/api/stream') {
      return bus.subscribe(res);
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      return json(200, bus.snapshot());
    }
    if (req.method === 'POST' && url.pathname === '/api/hook') {
      if (Number(req.headers['content-length']) > MAX_BODY) {
        res.writeHead(413, { 'Content-Type': 'application/json', Connection: 'close' });
        return res.end(JSON.stringify({ error: 'demasiado-grande' }));
      }
      let payload;
      try {
        payload = JSON.parse(await readBody(req));
      } catch {
        return json(400, { error: 'json-invalido' });
      }
      const result = sessions.apply(payload);
      if (!result) return json(202, { ignored: true });
      bus.publish('claude', { sessions: sessions.list(), activity: sessions.activity(), last: result });
      return json(200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/permission') {
      let payload;
      try {
        payload = JSON.parse(await readBody(req));
      } catch {
        return json(400, { error: 'json-invalido' });
      }
      const { id, promise } = permissions.request(payload);
      res.on('close', () => permissions.cancel(id)); // el hook se cortó: se limpia
      const decision = await promise;
      if (res.writableEnded || res.destroyed) return;
      // Sin respuesta a tiempo: {} deja que Claude Code pregunte en la terminal.
      return json(200, decision ? hookOutput(decision) : {});
    }
    if (req.method === 'POST' && url.pathname === '/api/focus' && focus) {
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return json(400, { error: 'json-invalido' });
      }
      return focus.act(body?.action) ? json(200, { ok: true }) : json(400, { error: 'accion-invalida' });
    }
    if (req.method === 'POST' && url.pathname === '/api/media' && media) {
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return json(400, { error: 'json-invalido' });
      }
      const ok = await media.control(body?.action);
      return ok ? json(200, { ok: true }) : json(400, { error: 'accion-invalida' });
    }
    if (req.method === 'POST' && url.pathname === '/api/permission/answer') {
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return json(400, { error: 'json-invalido' });
      }
      return permissions.answer(body?.id, body?.behavior)
        ? json(200, { ok: true })
        : json(404, { error: 'no-pendiente' });
    }
    return json(404, { error: 'not-found' });
  });
}
