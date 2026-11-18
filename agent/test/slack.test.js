import test from 'node:test';
import assert from 'node:assert/strict';
import { slackClient, cleanText, createSlack, yesterday, READ_ONLY } from '../src/slack.js';

const fakeSlack = (routes, calls = []) => async (url) => {
  const method = new URL(url).pathname.slice('/api/'.length);
  calls.push(method);
  const body = routes[method];
  return { ok: true, json: async () => (typeof body === 'function' ? body(new URL(url).searchParams) : body ?? { ok: false, error: 'unknown_method' }) };
};

test('slack: solo permite métodos de lectura', async () => {
  const call = slackClient('xoxp-x', fakeSlack({ 'chat.postMessage': { ok: true } }));
  await assert.rejects(call('chat.postMessage', { text: 'hola' }), /no permitido/);
  await assert.rejects(call('reactions.add'), /no permitido/);
  for (const m of READ_ONLY) assert.match(m, /\.(test|messages|conversations|info|history)$/);
});

test('slack: errores de la API se convierten en excepciones', async () => {
  const call = slackClient('xoxp-x', fakeSlack({ 'auth.test': { ok: false, error: 'invalid_auth' } }));
  await assert.rejects(call('auth.test'), /invalid_auth/);
});

test('cleanText: menciones, links, canales y entidades', () => {
  const names = new Map([['U2', 'beto']]);
  assert.equal(cleanText('hola <@U1|ana> y <@U2>', names), 'hola @ana y @beto');
  assert.equal(cleanText('mirá <https://x.com|esto> en <#C1|general> &amp; <!here>'), 'mirá esto en #general & @here');
  assert.equal(cleanText('x'.repeat(500)).length, 140);
});

test('yesterday: fecha local de ayer', () => {
  assert.equal(yesterday(new Date(2026, 10, 18, 10).getTime()), '2026-11-17');
});

test('createSlack: junta menciones de hoy y DMs sin leer', async () => {
  const calls = [];
  const refresh = createSlack({
    token: 'xoxp-x',
    now: () => new Date(2026, 10, 18, 10).getTime(),
    fetchImpl: fakeSlack({
      'auth.test': { ok: true, user_id: 'UME', user: 'maga' },
      'search.messages': (q) => {
        assert.equal(q.get('query'), '<@UME> after:2026-11-17');
        return { ok: true, messages: { paging: { total: 3 }, matches: [
          { username: 'ana', channel: { name: 'deploys' }, text: '<@UME> ¿lo revisás?', ts: '1795000000.000100' },
        ] } };
      },
      'users.conversations': { ok: true, channels: [{ id: 'D1', is_im: true, user: 'U2' }, { id: 'D2', is_im: true, user: 'U3' }] },
      'conversations.info': (q) => (q.get('channel') === 'D1'
        ? { ok: true, channel: { unread_count_display: 2 } }
        : { ok: true, channel: { last_read: '1795000000.0' } }),
      'conversations.history': { ok: true, messages: [{ user: 'UME' }] }, // solo mensajes míos: 0 sin leer
      'users.info': { ok: true, user: { profile: { display_name: 'beto' } } },
    }, calls),
  });
  const data = await refresh();
  assert.equal(data.mentionsToday, 3);
  assert.equal(data.mentions[0].from, 'ana');
  assert.equal(data.mentions[0].where, '#deploys');
  assert.equal(data.mentions[0].text, '@maga ¿lo revisás?');
  assert.deepEqual(data.dms, [{ from: 'beto', count: 2 }]);
  assert.equal(data.unreadDms, 2);
  assert.ok(calls.every((m) => READ_ONLY.has(m)), 'solo métodos de lectura');
});
