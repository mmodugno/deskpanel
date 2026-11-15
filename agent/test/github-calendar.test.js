import test from 'node:test';
import assert from 'node:assert/strict';
import { ciState, fetchRepo, fetchAll } from '../src/github.js';
import { parseIcs, parseDate, occurrences, upcoming, zonedToUtc } from '../src/calendar.js';

test('ciState: traduce estado y conclusión del último run', () => {
  assert.equal(ciState(undefined), 'none');
  assert.equal(ciState({ status: 'in_progress' }), 'running');
  assert.equal(ciState({ status: 'completed', conclusion: 'success' }), 'success');
  assert.equal(ciState({ status: 'completed', conclusion: 'failure' }), 'failure');
  assert.equal(ciState({ status: 'completed', conclusion: 'cancelled' }), 'other');
});

const fakeFetch = (routes) => async (url) => {
  const key = Object.keys(routes).find((k) => url.includes(k));
  return key ? { ok: true, json: async () => routes[key] } : { ok: false, status: 404 };
};

test('fetchRepo: junta CI y cantidad de PRs; rechaza nombres raros', async () => {
  const f = fakeFetch({
    '/actions/runs': { workflow_runs: [{ status: 'completed', conclusion: 'success', head_branch: 'main', updated_at: 'x' }] },
    '/pulls': [{}, {}],
  });
  const r = await fetchRepo('mmodugno/deskpanel', { fetchImpl: f });
  assert.deepEqual([r.ci, r.prs, r.branch], ['success', 2, 'main']);
  await assert.rejects(fetchRepo('../../etc/passwd', { fetchImpl: f }), /inválido/);
});

test('fetchAll: un repo que falla no rompe a los demás', async () => {
  const f = async (url) => url.includes('/malo/')
    ? { ok: false, status: 404 }
    : { ok: true, json: async () => (url.includes('/pulls') ? [] : { workflow_runs: [] }) };
  const list = await fetchAll(['a/bueno', 'a/malo'], { fetchImpl: f });
  assert.equal(list[0].ci, 'none');
  assert.equal(list[1].ci, 'error');
});

test('ics: UTC, zona horaria, día completo y líneas plegadas', () => {
  const text = [
    'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'SUMMARY:Reunión\\, equipo', 'DTSTART:20261116T130000Z', 'DTEND:20261116T140000Z', 'END:VEVENT',
    'BEGIN:VEVENT', 'SUMMARY:Cumple', 'DTSTART;VALUE=DATE:20261120', 'END:VEVENT',
    'BEGIN:VEVENT', 'SUMMARY:Clase largo', ' nombre', 'DTSTART;TZID=America/Argentina/Buenos_Aires:20261118T190000', 'END:VEVENT',
    'BEGIN:VEVENT', 'SUMMARY:Cancelado', 'STATUS:CANCELLED', 'DTSTART:20261116T130000Z', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const evs = parseIcs(text);
  assert.equal(evs.length, 3);
  assert.equal(evs[0].title, 'Reunión, equipo');
  assert.equal(evs[0].start, Date.UTC(2026, 10, 16, 13));
  assert.equal(evs[1].allDay, true);
  assert.equal(evs[2].title, 'Clase largonombre');
  assert.equal(evs[2].start, Date.UTC(2026, 10, 18, 22), 'Buenos Aires es UTC-3');
});

test('zonedToUtc: respeta el horario de verano de otra zona', () => {
  assert.equal(zonedToUtc(2026, 7, 1, 12, 0, 'America/New_York'), Date.UTC(2026, 6, 1, 16));
  assert.equal(zonedToUtc(2026, 1, 1, 12, 0, 'America/New_York'), Date.UTC(2026, 0, 1, 17));
});

test('parseDate: formato inválido devuelve null', () => {
  assert.equal(parseDate('', 'mañana'), null);
});

test('repeticiones semanales con BYDAY y diarias con intervalo', () => {
  const base = new Date(2026, 10, 2, 9, 0).getTime(); // lunes 2/nov 9:00 local
  const weekly = { title: 'Daily', start: base, end: base + 1800000, rrule: { FREQ: 'WEEKLY', BYDAY: 'MO,WE' } };
  const from = new Date(2026, 10, 15, 0, 0).getTime();
  const occ = occurrences(weekly, from, from + 7 * 86400000);
  assert.deepEqual(occ.map((o) => new Date(o.start).getDate()), [16, 18]);
  const every2 = { title: 'x', start: base, rrule: { FREQ: 'DAILY', INTERVAL: '2' } };
  const days = occurrences(every2, from, from + 6 * 86400000).map((o) => new Date(o.start).getDate());
  assert.deepEqual(days, [16, 18, 20]);
  const until = { title: 'y', start: base, rrule: { FREQ: 'DAILY', UNTIL: '20261117T235959Z' } };
  assert.deepEqual(occurrences(until, from, from + 6 * 86400000).map((o) => new Date(o.start).getDate()), [15, 16, 17]);
});

test('upcoming: ordena, descarta pasados y limita', () => {
  const now = Date.UTC(2026, 10, 16, 12);
  const evs = [
    { title: 'pasado', start: now - 7200000, end: now - 3600000 },
    { title: 'c', start: now + 3 * 3600000 }, { title: 'a', start: now + 3600000 }, { title: 'b', start: now + 7200000 },
  ];
  assert.deepEqual(upcoming(evs, now, 86400000, 2).map((e) => e.title), ['a', 'b']);
  assert.equal(upcoming([{ title: 'en curso', start: now - 1800000, end: now + 1800000 }], now)[0].title, 'en curso');
});
