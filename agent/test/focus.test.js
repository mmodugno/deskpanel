import test from 'node:test';
import assert from 'node:assert/strict';
import { createFocus } from '../src/focus.js';

function setup(config = { workMin: 1, breakMin: 1, longBreakMin: 2, cycles: 2 }) {
  let t = new Date(2026, 10, 15, 10, 0, 0).getTime();
  const events = [];
  const f = createFocus({ config, now: () => t, onChange: (s) => events.push(s) });
  return { f, advance: (ms) => { t += ms; return f.tick(); }, events };
}

test('arranca en pausa con el tiempo de trabajo completo', () => {
  const { f } = setup();
  const s = f.state();
  assert.equal(s.phase, 'work');
  assert.equal(s.running, false);
  assert.equal(s.remainingMs, 60000);
});

test('start y pause conservan el tiempo restante', () => {
  const { f, advance } = setup();
  f.act('start');
  advance(20000);
  f.act('pause');
  assert.equal(f.state().remainingMs, 40000);
  advance(60000); // pausado: no corre
  assert.equal(f.tick(), false);
  assert.equal(f.state().remainingMs, 40000);
  f.act('start');
  assert.equal(f.state().running, true);
});

test('al terminar el trabajo suma pomodoro y arranca el descanso solo', () => {
  const { f, advance } = setup();
  f.act('start');
  assert.equal(advance(60000), true);
  const s = f.state();
  assert.equal(s.phase, 'break');
  assert.equal(s.running, true);
  assert.equal(s.today, 1);
  assert.equal(s.transitions, 1);
});

test('después del descanso espera, y a la segunda tanda viene el descanso largo', () => {
  const { f, advance } = setup();
  f.act('start'); advance(60000); // trabajo 1 -> descanso
  advance(60000); // descanso -> trabajo (en pausa)
  assert.equal(f.state().phase, 'work');
  assert.equal(f.state().running, false);
  f.act('start'); advance(60000); // trabajo 2 -> descanso largo
  const s = f.state();
  assert.equal(s.phase, 'longbreak');
  assert.equal(s.remainingMs, 120000);
  assert.equal(s.cycle, 0);
  assert.equal(s.today, 2);
});

test('reset vuelve al inicio sin borrar lo de hoy; skip no cuenta pomodoro', () => {
  const { f, advance } = setup();
  f.act('start'); advance(60000);
  f.act('reset');
  assert.equal(f.state().phase, 'work');
  assert.equal(f.state().today, 1);
  f.act('skip');
  assert.equal(f.state().phase, 'break');
  assert.equal(f.state().today, 1);
  f.act('skip');
  assert.equal(f.state().phase, 'work');
});

test('acciones inválidas se rechazan y el contador de hoy se reinicia al cambiar el día', () => {
  let t = new Date(2026, 10, 15, 23, 59, 0).getTime();
  const f = createFocus({ config: { workMin: 1 }, now: () => t });
  assert.equal(f.act('explotar'), false);
  f.act('start'); t += 60000; f.tick();
  assert.equal(f.state().today, 1);
  t += 24 * 3600000;
  f.act('start'); // dispara el cambio de día
  assert.equal(f.state().today, 0);
});
