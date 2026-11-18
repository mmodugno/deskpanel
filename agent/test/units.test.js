import test from 'node:test';
import assert from 'node:assert/strict';
import { createToken, tokenMatches, extractToken } from '../src/auth.js';
import { cpuPercent, memoryInfo } from '../src/metrics.js';
import { createSessions, projectName, describeTool } from '../src/claude-sessions.js';
import { describeCode, fetchWeather } from '../src/weather.js';
import { lanAddresses } from '../src/network.js';
import { loadConfig } from '../src/config.js';

test('token: largo, único y comparación estricta', () => {
  const a = createToken();
  assert.equal(a.length, 32);
  assert.notEqual(a, createToken());
  assert.ok(tokenMatches(a, a));
  assert.ok(!tokenMatches(a, a.slice(1)));
  assert.ok(!tokenMatches(a, undefined));
  assert.ok(!tokenMatches(a, null));
});

test('token: se lee de Bearer o de query', () => {
  const url = new URL('http://x/?token=q');
  assert.equal(extractToken({ headers: { authorization: 'Bearer h' } }, url), 'h');
  assert.equal(extractToken({ headers: {} }, url), 'q');
});

test('cpuPercent: calcula uso y acota a 0-100', () => {
  assert.equal(cpuPercent({ idle: 0, total: 0 }, { idle: 75, total: 100 }), 25);
  assert.equal(cpuPercent({ idle: 5, total: 10 }, { idle: 5, total: 10 }), 0);
  assert.equal(cpuPercent({ idle: 0, total: 0 }, { idle: 0, total: 100 }), 100);
});

test('memoryInfo: porcentaje y GB', () => {
  const gb = 1024 ** 3;
  assert.deepEqual(memoryInfo(16 * gb, 4 * gb), { totalGb: 16, usedGb: 12, percent: 75 });
  assert.equal(memoryInfo(0, 0).percent, 0);
});

test('projectName: rutas de Windows y Unix', () => {
  assert.equal(projectName('C:\\Users\\x\\mi-proyecto'), 'mi-proyecto');
  assert.equal(projectName('/home/x/otro/'), 'otro');
  assert.equal(projectName(undefined), 'sesión');
});

test('sesiones: transiciones de estado y SessionEnd', () => {
  let t = 100;
  const s = createSessions(() => t);
  const base = { session_id: 'a', cwd: '/p/app' };
  assert.equal(s.apply({ ...base, hook_event_name: 'PreToolUse' }).state, 'working');
  t = 200;
  s.apply({ ...base, hook_event_name: 'PostToolUse' });
  assert.equal(s.list()[0].since, 100, 'sin cambio de estado conserva since');
  t = 300;
  s.apply({ ...base, hook_event_name: 'Notification', message: 'permiso' });
  assert.equal(s.list()[0].state, 'waiting');
  assert.equal(s.list()[0].message, 'permiso');
  s.apply({ ...base, hook_event_name: 'Stop' });
  assert.equal(s.list()[0].state, 'done');
  assert.equal(s.list()[0].message, '');
  s.apply({ ...base, hook_event_name: 'SessionEnd' });
  assert.equal(s.list().length, 0);
});

test('sesiones: prompt, herramienta en curso y duración de la tarea', () => {
  let t = 1000;
  const s = createSessions(() => t);
  const base = { session_id: 'a', cwd: '/p/app' };
  s.apply({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'arreglá\n  el   login' });
  assert.equal(s.list()[0].prompt, 'arreglá el login');
  assert.equal(s.list()[0].doing, '');
  t = 2000;
  s.apply({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'C:\\x\\src\\login.js' } });
  assert.equal(s.list()[0].doing, 'editando login.js');
  s.apply({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Edit' });
  assert.equal(s.list()[0].doing, 'editando login.js', 'PostToolUse conserva lo último');
  s.apply({ ...base, hook_event_name: 'Notification', message: 'permiso' });
  t = 1000 + 5 * 60000;
  s.apply({ ...base, hook_event_name: 'Stop' });
  const done = s.list()[0];
  assert.equal(done.took, 5 * 60000, 'pedir permiso no corta la tarea');
  assert.equal(done.doing, '');
  assert.equal(done.prompt, 'arreglá el login');
});

test('describeTool: frases cortas por herramienta', () => {
  assert.equal(describeTool('Bash', { command: 'npm test\nmás' }), '$ npm test');
  assert.equal(describeTool('Write', { file_path: '/a/b/c.md' }), 'escribiendo c.md');
  assert.equal(describeTool('Grep', { pattern: 'TODO' }), 'buscando TODO');
  assert.equal(describeTool('WebFetch', { url: 'https://docs.x.com/a' }), 'leyendo docs.x.com');
  assert.equal(describeTool('WebFetch', { url: 'no es url' }), 'leyendo una página');
  assert.equal(describeTool('mcp__slack__read_channel', {}), 'read_channel (slack)');
  assert.equal(describeTool('Raro', null), 'Raro');
  assert.equal(describeTool(undefined), 'trabajando');
});

test('sesiones: ignora eventos desconocidos y payloads corruptos', () => {
  const s = createSessions();
  assert.equal(s.apply(null), null);
  assert.equal(s.apply({}), null);
  assert.equal(s.apply({ hook_event_name: 'Raro', session_id: 'a' }), null);
  assert.equal(s.apply({ hook_event_name: 'Stop', session_id: 5 }), null);
  const r = s.apply({ hook_event_name: 'Notification', session_id: 'a', message: 'x'.repeat(999) });
  assert.equal(s.list()[0].message.length, 160);
  assert.ok(r.changed);
});

test('clima: códigos y respuesta de la API (con fetch simulado)', async () => {
  assert.equal(describeCode(0), 'Despejado');
  assert.equal(describeCode(95), 'Tormenta');
  assert.equal(describeCode(12345), 'Sin datos');
  const fake = async () => ({
    ok: true,
    json: async () => ({ current: { temperature_2m: 21.6, weather_code: 3 } }),
  });
  assert.deepEqual(await fetchWeather({ latitude: 0, longitude: 0, name: 'X' }, fake), {
    name: 'X', temp: 22, text: 'Nublado',
  });
  await assert.rejects(fetchWeather({}, async () => ({ ok: false, status: 500 })));
});

test('lanAddresses: solo IPv4 externas', () => {
  const ifs = {
    lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    eth: [
      { family: 'IPv6', address: 'fe80::1', internal: false },
      { family: 'IPv4', address: '192.168.1.5', internal: false },
    ],
  };
  assert.deepEqual(lanAddresses(ifs), ['192.168.1.5']);
});

test('config: valida puerto y JSON inválido', () => {
  assert.equal(loadConfig('/no/existe.json', {}).port, 4747);
  assert.equal(loadConfig('/no/existe.json', { DESKPANEL_PORT: '5000' }).port, 5000);
  assert.throws(() => loadConfig('/no/existe.json', { DESKPANEL_PORT: '99999' }), /Puerto/);
  assert.throws(() => loadConfig('/no/existe.json', { DESKPANEL_PORT: 'abc' }), /Puerto/);
});

import { pushHistory } from '../src/metrics.js';

test('historial: tope de muestras, descarta las más viejas', () => {
  const h = [];
  for (let i = 0; i < 5; i++) pushHistory(h, i, 3);
  assert.deepEqual(h, [2, 3, 4]);
});

test('actividad: cuenta cuándo empieza a trabajar y reinicia al cambiar el día', () => {
  let t = new Date(2026, 10, 15, 9, 30).getTime();
  const s = createSessions(() => t);
  const ev = { session_id: 'a', cwd: '/p/x' };
  s.apply({ ...ev, hook_event_name: 'PreToolUse' });
  s.apply({ ...ev, hook_event_name: 'PostToolUse' }); // sigue trabajando: no suma
  s.apply({ ...ev, hook_event_name: 'Stop' });
  t = new Date(2026, 10, 15, 9, 50).getTime();
  s.apply({ ...ev, hook_event_name: 'PreToolUse' });
  assert.equal(s.activity()[9], 2);
  t = new Date(2026, 10, 16, 10, 0).getTime();
  s.apply({ ...ev, hook_event_name: 'Stop' });
  s.apply({ ...ev, hook_event_name: 'PreToolUse' });
  assert.equal(s.activity()[9], 0);
  assert.equal(s.activity()[10], 1);
});
