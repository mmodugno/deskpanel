import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDevices, unauthorized, createUsbWatcher } from '../src/usb.js';

const LIST = (rows) => ['List of devices attached', ...rows, ''].join('\n');

test('parseDevices: solo los autorizados', () => {
  assert.deepEqual(parseDevices(LIST(['R58M\tdevice', 'XYZ\tunauthorized', 'ABC\toffline'])), ['R58M']);
  assert.deepEqual(parseDevices(LIST([])), []);
  assert.deepEqual(parseDevices(undefined), []);
  assert.ok(unauthorized(LIST(['XYZ\tunauthorized'])));
  assert.ok(!unauthorized(LIST(['R58M\tdevice'])));
});

test('al conectar un celular hace adb reverse una sola vez', async () => {
  const calls = [];
  const exec = async (f, args) => { calls.push(args.join(' ')); return args[0] === 'devices' ? LIST(['R58M\tdevice']) : ''; };
  const logs = [];
  const w = createUsbWatcher({ port: 4747, exec, log: (m) => logs.push(m) });
  await w.check();
  await w.check();
  assert.equal(calls.filter((c) => c.includes('reverse')).length, 1);
  assert.ok(calls.includes('-s R58M reverse tcp:4747 tcp:4747'));
  assert.deepEqual(w.ready(), ['R58M']);
  assert.match(logs[0], /conectado: R58M/);
});

test('si se desenchufa y se vuelve a enchufar, repite el reverse', async () => {
  let devs = ['R58M\tdevice'];
  const calls = [];
  const exec = async (f, args) => { calls.push(args.join(' ')); return args[0] === 'devices' ? LIST(devs) : ''; };
  const w = createUsbWatcher({ port: 1, exec });
  await w.check();
  devs = [];
  await w.check();
  assert.deepEqual(w.ready(), []);
  devs = ['R58M\tdevice'];
  await w.check();
  assert.equal(calls.filter((c) => c.includes('reverse')).length, 2);
});

test('sin adb avisa una sola vez; sin autorizar avisa qué hacer; si reverse falla reintenta', async () => {
  const logs = [];
  const w1 = createUsbWatcher({ port: 1, exec: async () => { throw new Error('ENOENT'); }, log: (m) => logs.push(m) });
  await w1.check(); await w1.check();
  assert.equal(logs.length, 1);
  assert.match(logs[0], /adb/);

  const logs2 = [];
  const w2 = createUsbWatcher({ port: 1, exec: async () => LIST(['XYZ\tunauthorized']), log: (m) => logs2.push(m) });
  await w2.check(); await w2.check();
  assert.equal(logs2.length, 1);
  assert.match(logs2[0], /depuración USB/);

  let fail = true;
  const w3 = createUsbWatcher({ port: 1, exec: async (f, a) => { if (a[0] === 'devices') return LIST(['A\tdevice']); if (fail) throw new Error('x'); return ''; } });
  await w3.check();
  assert.deepEqual(w3.ready(), []);
  fail = false;
  await w3.check();
  assert.deepEqual(w3.ready(), ['A']);
});
