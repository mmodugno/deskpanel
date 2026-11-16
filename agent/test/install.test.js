import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOrCreateToken } from '../src/token-store.js';
import { isLoopback, pairPage, pairUrls } from '../src/pair.js';
import { createServer } from '../src/server.js';
import { createBus } from '../src/bus.js';
import { createSessions } from '../src/claude-sessions.js';
import { createPermissions } from '../src/permissions.js';

test('token: se crea una vez, se reutiliza y se ignora si está corrupto', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dp-'));
  const path = join(dir, 'sub', 'token');
  const a = loadOrCreateToken(path, {});
  assert.equal(a.created, true);
  assert.match(a.token, /^[a-f0-9]{32}$/);
  const b = loadOrCreateToken(path, {});
  assert.deepEqual([b.token, b.created], [a.token, false]);
  if (process.platform !== 'win32') assert.equal(statSync(path).mode & 0o077, 0, 'solo lo lee su dueña');
  writeFileSync(path, 'basura');
  assert.equal(loadOrCreateToken(path, {}).created, true);
  assert.equal(readFileSync(path, 'utf8').trim().length, 32);
});

test('token: la variable de entorno manda y no escribe nada', () => {
  const r = loadOrCreateToken('/ruta/que/no/existe/token', { DESKPANEL_TOKEN: 'fijo' });
  assert.deepEqual(r, { token: 'fijo', created: false });
});

test('pair: solo loopback, links con token y HTML escapado', () => {
  assert.ok(isLoopback('127.0.0.1') && isLoopback('::1') && isLoopback('::ffff:127.0.0.1'));
  assert.ok(!isLoopback('192.168.1.9') && !isLoopback(undefined));
  assert.deepEqual(pairUrls(['192.168.1.5'], 4747, 'abc'), ['http://192.168.1.5:4747/?token=abc']);
  const html = pairPage(['http://x/?a=<b>"&'], 'http://localhost:4747/?token=t');
  assert.ok(!html.includes('<b>"'));
  assert.match(html, /&lt;b&gt;&quot;&amp;/);
  assert.match(pairPage([], 'u'), /modo USB/);
});

test('HTTP: /pair responde desde la PC y 404 si no hay emparejamiento configurado', async () => {
  const bus = createBus();
  const base = { token: 't', bus, sessions: createSessions(), permissions: createPermissions() };
  for (const [pairing, status] of [[{ urls: () => ['http://1.2.3.4:1/?token=t'], usbUrl: () => 'u' }, 200], [undefined, 404]]) {
    const server = createServer({ ...base, pairing });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const res = await fetch(`http://127.0.0.1:${server.address().port}/pair`);
    assert.equal(res.status, status);
    if (status === 200) assert.match(await res.text(), /1\.2\.3\.4/);
    server.closeAllConnections(); server.close();
  }
});
