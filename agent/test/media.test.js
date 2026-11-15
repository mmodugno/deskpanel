import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMedia, createMedia, windowsScript, macControlScript, startMedia } from '../src/media.js';
import { createBus } from '../src/bus.js';

test('parseMedia: estados, acentos y salidas vacías', () => {
  assert.deepEqual(parseMedia('Canción|||Artista|||Álbum|||Playing'), { title: 'Canción', artist: 'Artista', album: 'Álbum', status: 'playing', source: null });
  assert.equal(parseMedia('a|||b|||c|||Paused').status, 'paused');
  assert.equal(parseMedia('a|||b|||c|||Stopped').status, 'stopped');
  assert.equal(parseMedia('Spotify|||t|||a|||al|||playing').source, 'Spotify');
  assert.equal(parseMedia(''), null);
  assert.equal(parseMedia(undefined), null);
  assert.equal(parseMedia('|||x|||y|||playing'), null, 'sin título no hay nada que mostrar');
  assert.equal(parseMedia('x'.repeat(500) + '|||a|||b|||playing').title.length, 200);
});

test('Windows: usa PowerShell codificado y lee la sesión actual', async () => {
  const calls = [];
  const m = createMedia({ platform: 'win32', exec: async (f, a) => { calls.push([f, a]); return 'Tema|||Banda|||Disco|||Playing\r\n'; } });
  assert.equal((await m.read()).title, 'Tema');
  assert.equal(calls[0][0], 'powershell.exe');
  assert.ok(calls[0][1].includes('-EncodedCommand'));
  const decoded = Buffer.from(calls[0][1].at(-1), 'base64').toString('utf16le');
  assert.match(decoded, /GlobalSystemMediaTransportControlsSessionManager/);
  assert.match(windowsScript('next'), /TrySkipNextAsync/);
});

test('macOS: recuerda qué app suena y le manda los controles a esa', async () => {
  const calls = [];
  const m = createMedia({ platform: 'darwin', exec: async (f, a) => { calls.push(a[1]); return calls.length === 1 ? 'Music|||t|||a|||al|||paused' : ''; } });
  assert.equal((await m.read()).source, 'Music');
  await m.control('play-pause');
  assert.equal(calls[1], macControlScript('play-pause', 'Music'));
  assert.match(calls[1], /tell application "Music" to playpause/);
});

test('Linux: playerctl; acciones inválidas rechazadas; sin reproductor devuelve null', async () => {
  const seen = [];
  const m = createMedia({ platform: 'linux', exec: async (f, a) => { seen.push([f, ...a]); return 'x|||y|||z|||Playing'; } });
  assert.equal((await m.read()).status, 'playing');
  assert.equal(await m.control('borrar-todo'), false);
  assert.equal(await m.control('next'), true);
  assert.deepEqual(seen.at(-1), ['playerctl', 'next']);
  const none = createMedia({ platform: 'linux', exec: async () => { throw new Error('ENOENT'); } });
  assert.equal(await none.read(), null);
});

test('startMedia: solo consulta con paneles conectados y publica solo si cambió', async () => {
  const bus = createBus();
  let reads = 0;
  const media = { read: async () => { reads += 1; return { title: 'T', artist: 'A', album: '', status: 'playing', source: null }; } };
  const published = [];
  const orig = bus.publish.bind(bus);
  bus.publish = (t, d) => { published.push([t, d]); orig(t, d); };
  const timer = startMedia(bus, media, 10);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(reads, 0, 'sin clientes no consulta');
  const fake = { writeHead() {}, write() {}, on() {}, end() {} };
  bus.subscribe(fake);
  await new Promise((r) => setTimeout(r, 80));
  clearInterval(timer);
  assert.ok(reads >= 1);
  assert.equal(published.filter(([t, d]) => t === 'media' && d.title === 'T').length, 1, 'no repite lo mismo');
  bus.closeAll();
});
