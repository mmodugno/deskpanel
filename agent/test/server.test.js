import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { createBus } from '../src/bus.js';
import { createSessions } from '../src/claude-sessions.js';
import { createPermissions } from '../src/permissions.js';

async function start() {
  const bus = createBus();
  const server = createServer({ token: 't0k', bus, sessions: createSessions(), permissions: createPermissions() });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { bus, base, close: () => { bus.closeAll(); server.closeAllConnections(); server.close(); } };
}

test('API exige token y el panel estático es público', async () => {
  const { base, close } = await start();
  assert.equal((await fetch(`${base}/api/state`)).status, 401);
  assert.equal((await fetch(`${base}/api/state?token=mal`)).status, 401);
  assert.equal((await fetch(`${base}/api/state?token=t0k`)).status, 200);
    close();
});

test('no permite salirse de la carpeta del panel', async () => {
  const { base, close } = await start();
  const res = await fetch(`${base}/..%2Fpackage.json`);
  assert.ok([403, 404].includes(res.status));
  close();
});

test('hooks: acepta válidos, rechaza JSON roto y publica en el bus', async () => {
  const { base, bus, close } = await start();
  const post = (body) => fetch(`${base}/api/hook?token=t0k`, { method: 'POST', body });
  assert.equal((await post('no es json')).status, 400);
  assert.equal((await post('{"hook_event_name":"Raro"}')).status, 202);
  const ok = await post(JSON.stringify({ hook_event_name: 'Stop', session_id: 's', cwd: '/a/b' }));
  assert.equal(ok.status, 200);
  assert.equal(bus.snapshot().claude.sessions[0].state, 'done');
  assert.equal((await post('x'.repeat(20000))).status, 413);
  close();
});

test('SSE: el cliente nuevo recibe el último estado', async () => {
  const { base, bus, close } = await start();
  bus.publish('system', { cpu: 7 });
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/stream?token=t0k`, { signal: ctrl.signal });
  const { value } = await res.body.getReader().read();
  const text = new TextDecoder().decode(value);
  assert.match(text, /event: system/);
  assert.match(text, /"cpu":7/);
  ctrl.abort();
  close();
});
