import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSince, isHot, alertFor, readToken, formatTime } from '../../panel/format.js';

test('formatSince: ahora, minutos y horas', () => {
  assert.equal(formatSince(1000, 1000), 'ahora');
  assert.equal(formatSince(0, 5 * 60000), 'hace 5 min');
  assert.equal(formatSince(0, 125 * 60000), 'hace 2 h');
  assert.equal(formatSince(5000, 0), 'ahora', 'reloj adelantado no da negativos');
});

test('isHot: umbral de CPU', () => {
  assert.ok(!isHot(84));
  assert.ok(isHot(85));
});

test('alertFor: solo permiso o fin con cambio de estado', () => {
  assert.equal(alertFor({ changed: true, state: 'waiting' }), 'waiting');
  assert.equal(alertFor({ changed: true, state: 'done' }), 'done');
  assert.equal(alertFor({ changed: true, state: 'working' }), null);
  assert.equal(alertFor({ changed: false, state: 'waiting' }), null);
  assert.equal(alertFor(null), null);
});

test('readToken: prioriza la URL sobre lo guardado', () => {
  assert.equal(readToken('?token=nuevo', 'viejo'), 'nuevo');
  assert.equal(readToken('', 'viejo'), 'viejo');
  assert.equal(readToken('', null), null);
});

test('formatTime: 24 h con dos dígitos', () => {
  assert.match(formatTime(new Date(2026, 10, 15, 9, 5)), /^09:05$/);
});

import { greetingFor, isNight, arcDash } from '../../panel/format.js';

test('saludo y modo noche según la hora', () => {
  assert.equal(greetingFor(8), 'Buen día');
  assert.equal(greetingFor(15), 'Buenas tardes');
  assert.equal(greetingFor(2), 'Buenas noches');
  assert.ok(isNight(23) && isNight(3));
  assert.ok(!isNight(7) && !isNight(22));
});

test('arcDash: 270° de recorrido y valores acotados', () => {
  assert.equal(arcDash(0), '0.0 100');
  assert.equal(arcDash(100), '75.0 100');
  assert.equal(arcDash(200), '75.0 100');
  assert.equal(arcDash(-5), '0.0 100');
});

import { nextCpu, nextState } from '../../panel/demo.js';

test('demo: la CPU se mantiene acotada y el ciclo de estados vuelve a empezar', () => {
  assert.equal(nextCpu(95, () => 1), 96);
  assert.equal(nextCpu(5, () => 0), 4);
  assert.equal(nextState('working'), 'waiting');
  assert.equal(nextState('waiting'), 'done');
  assert.equal(nextState('done'), 'working');
});

import { sparkPath, barHeights } from '../../panel/format.js';

test('sparkPath: curva y área, vacío con pocos datos y valores acotados', () => {
  assert.deepEqual(sparkPath([5], 100, 50), { line: '', area: '' });
  const { line, area } = sparkPath([0, 100, 50], 100, 50);
  assert.match(line, /^M0\.0 50\.0 C/);
  assert.ok(area.endsWith('L100 50 L0 50 Z'));
  assert.equal(sparkPath([0, 500], 10, 10).line.includes('-'), false, 'no se sale del cuadro');
});

test('barHeights: normaliza a la hora más activa', () => {
  assert.deepEqual(barHeights([0, 2, 4]), [0, 50, 100]);
  assert.deepEqual(barHeights([0, 0]), [0, 0]);
});

import { nextTheme, themeName } from '../../panel/format.js';

test('temas: ciclo completo y valor desconocido cae en el primero', () => {
  assert.equal(nextTheme('violeta'), 'medianoche');
  assert.equal(nextTheme('grafito'), 'violeta');
  assert.equal(nextTheme('raro'), 'violeta');
  assert.equal(themeName('orquidea'), 'Orquídea');
  assert.equal(themeName('raro'), 'Violeta');
});

import { timeLeft, permissionTitle } from '../../panel/format.js';

test('timeLeft: fracción restante acotada de 0 a 1', () => {
  const p = { since: 0, expiresAt: 100 };
  assert.equal(timeLeft(p, 25), 0.75);
  assert.equal(timeLeft(p, 500), 0);
  assert.equal(timeLeft(p, -50), 1);
  assert.equal(timeLeft({ since: 5, expiresAt: 5 }, 5), 0);
  assert.equal(permissionTitle({ tool: 'Bash', project: 'app' }), 'Bash · app');
});

import { formatUptime, rangeText } from '../../panel/format.js';

test('formatUptime: minutos, horas y días', () => {
  assert.equal(formatUptime(0), 'menos de 1 min');
  assert.equal(formatUptime(45), '45 min');
  assert.equal(formatUptime(125), '2 h 5 min');
  assert.equal(formatUptime(3000), '2 d 2 h');
  assert.equal(formatUptime(undefined), 'menos de 1 min');
});

test('rangeText: mínimo y máximo del historial', () => {
  assert.equal(rangeText([10, 40, 25]), 'mín 10% · máx 40%');
  assert.equal(rangeText([]), '');
});
