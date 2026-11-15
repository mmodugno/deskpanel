import test from 'node:test';
import assert from 'node:assert/strict';
import { createPermissions, summarize, hookOutput } from '../src/permissions.js';
import { createServer } from '../src/server.js';
import { createBus } from '../src/bus.js';
import { createSessions } from '../src/claude-sessions.js';

test('summarize: comando, archivo y recorte', () => {
  assert.deepEqual(summarize('Bash', { command: 'git push' }), { tool: 'Bash', detail: 'git push' });
  assert.equal(summarize('Edit', { file_path: '/a/b.js' }).detail, '/a/b.js');
  assert.equal(summarize('Bash', { command: 'x'.repeat(5000) }).detail.length, 600);
  assert.deepEqual(summarize(undefined, null), { tool: 'Herramienta', detail: '' });
});

test('hookOutput: formato de decisión que espera Claude Code', () => {
  assert.equal(hookOutput('allow').hookSpecificOutput.decision.behavior, 'allow');
  const deny = hookOutput('deny').hookSpecificOutput.decision;
  assert.equal(deny.behavior, 'deny');
  assert.ok(deny.message);
});

test('permisos: responder resuelve la promesa y vacía la lista', async () => {
  const changes = [];
  const p = createPermissions({ onChange: (l) => changes.push(l.length) });
  const { id, promise } = p.request({ tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: '/x/app' });
  assert.equal(p.list()[0].project, 'app');
  assert.equal(p.answer('otro', 'allow'), false);
  assert.equal(p.answer(id, 'quizas'), false);
  assert.equal(p.answer(id, 'allow'), true);
  assert.equal(await promise, 'allow');
  assert.deepEqual(changes, [1, 0]);
  assert.equal(p.answer(id, 'allow'), false, 'no se responde dos veces');
});

test('permisos: vence por tiempo y devuelve null', async () => {
  const p = createPermissions({ timeoutMs: 20 });
  const { promise } = p.request({ tool_name: 'Bash' });
  assert.equal(await promise, null);
  assert.equal(p.list().length, 0);
});

async function start(timeoutMs) {
  const bus = createBus();
  const permissions = createPermissions({ timeoutMs, onChange: (pending) => bus.publish('permissions', { pending }) });
  const server = createServer({ token: 't', bus, sessions: createSessions(), permissions });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, bus, permissions, close: () => { bus.closeAll(); server.closeAllConnections(); server.close(); } };
}

test('HTTP: el hook espera y recibe la decisión tomada desde el panel', async () => {
  const { base, permissions, close } = await start(5000);
  const hook = fetch(`${base}/api/permission?token=t`, { method: 'POST', body: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'rm x' }, cwd: '/p/demo' }) });
  await new Promise((r) => setTimeout(r, 100));
  const [pend] = permissions.list();
  assert.equal(pend.detail, 'rm x');
  const ans = await fetch(`${base}/api/permission/answer?token=t`, { method: 'POST', body: JSON.stringify({ id: pend.id, behavior: 'deny' }) });
  assert.equal(ans.status, 200);
  const out = await (await hook).json();
  assert.equal(out.hookSpecificOutput.decision.behavior, 'deny');
  const again = await fetch(`${base}/api/permission/answer?token=t`, { method: 'POST', body: JSON.stringify({ id: pend.id, behavior: 'allow' }) });
  assert.equal(again.status, 404);
  close();
});

test('HTTP: sin respuesta a tiempo devuelve {} (la terminal pregunta igual)', async () => {
  const { base, close } = await start(50);
  const res = await fetch(`${base}/api/permission?token=t`, { method: 'POST', body: JSON.stringify({ tool_name: 'Bash' }) });
  assert.deepEqual(await res.json(), {});
  close();
});

test('HTTP: pedir o responder permisos exige token', async () => {
  const { base, close } = await start(50);
  assert.equal((await fetch(`${base}/api/permission`, { method: 'POST', body: '{}' })).status, 401);
  assert.equal((await fetch(`${base}/api/permission/answer`, { method: 'POST', body: '{}' })).status, 401);
  close();
});

test('HTTP: si el hook se corta, el pendiente desaparece', async () => {
  const { base, permissions, close } = await start(5000);
  const ctrl = new AbortController();
  fetch(`${base}/api/permission?token=t`, { method: 'POST', body: '{"tool_name":"Bash"}', signal: ctrl.signal }).catch(() => {});
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(permissions.list().length, 1);
  ctrl.abort();
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(permissions.list().length, 0);
  close();
});
