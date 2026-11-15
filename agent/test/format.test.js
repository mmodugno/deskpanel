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
