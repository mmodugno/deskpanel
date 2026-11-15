import { formatTime, formatDate, formatSince, isHot, alertFor, readToken, greetingFor, isNight, STATE_LABEL, arcDash, sparkPath, barHeights } from './format.js';
import { arm, notify } from './alerts.js';
import { startDemo } from './demo.js';

const $ = (id) => document.getElementById(id);
// El almacenamiento puede estar bloqueado (modo privado, iframes): no debe romper el panel.
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const token = readToken(location.search, store.get('deskpanel.token'));
if (token) {
  store.set('deskpanel.token', token);
  history.replaceState(null, '', location.pathname); // el token no queda en la barra
}

function setLink(state, text) {
  $('link').dataset.state = state;
  $('link').querySelector('b').textContent = text;
}

function tickClock() {
  const now = new Date();
  $('time').textContent = formatTime(now);
  $('date').textContent = formatDate(now);
  $('greeting').textContent = greetingFor(now.getHours());
  document.body.classList.toggle('night', isNight(now.getHours()));
  renderSessionAges();
}
setInterval(tickClock, 1000);
tickClock();

const handlers = {
  system(d) {
    $('host').textContent = d.host;
    $('cpuArc').style.strokeDasharray = arcDash(d.cpu);
    $('cpuArc').dataset.hot = String(isHot(d.cpu));
    $('cpuValue').textContent = d.cpu;
    $('memBig').firstChild.textContent = d.mem.percent;
    $('memFill').style.width = `${d.mem.percent}%`;
    $('memText').textContent = `${d.mem.usedGb} / ${d.mem.totalGb} GB`;
    if (d.hist) drawChart(d.hist);
  },
  weather(d) {
    $('weatherCell').hidden = false;
    $('weatherTemp').textContent = `${d.temp}°`;
    $('weatherText').textContent = [d.name, d.text].filter(Boolean).join(' · ');
  },
  claude(d) {
    renderSessions(d.sessions);
    if (d.activity) drawBars(d.activity);
    const kind = alertFor(d.last);
    if (kind && !firstClaudeEvent) notify(kind, $('flash'));
    firstClaudeEvent = false;
  },
};
let firstClaudeEvent = true; // el estado inicial al conectar no dispara alertas

function drawChart(hist) {
  const cpu = sparkPath(hist.cpu, 300, 100);
  $('cpuPath').setAttribute('d', cpu.line);
  $('areaPath').setAttribute('d', cpu.area);
  $('memPath').setAttribute('d', sparkPath(hist.mem, 300, 100).line);
}

function drawBars(counts) {
  const wrap = $('bars');
  if (wrap.children.length !== 24) {
    wrap.replaceChildren(...Array.from({ length: 24 }, () => document.createElement('i')));
  }
  const hour = new Date().getHours();
  barHeights(counts).forEach((h, i) => {
    const bar = wrap.children[i];
    bar.style.height = `${Math.max(h, 6)}%`;
    bar.classList.toggle('on', counts[i] > 0);
    bar.classList.toggle('now', i === hour);
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderSessions(list) {
  const ul = $('sessions');
  ul.replaceChildren();
  if (!list.length) {
    ul.append(el('li', 'empty', 'Sin sesiones activas'));
    return;
  }
  for (const s of list) {
    const li = el('li', 'session');
    li.dataset.state = s.state;
    const state = el('span', 's-state');
    state.append(document.createElement('i'), STATE_LABEL[s.state] ?? s.state);
    const age = el('span', 's-since');
    age.dataset.since = s.since;
    li.append(el('span', 's-name', s.project), state);
    if (s.message) li.append(el('span', 's-msg', s.message));
    li.append(age);
    ul.append(li);
  }
  renderSessionAges();
}
function renderSessionAges() {
  const now = Date.now();
  for (const el of document.querySelectorAll('.s-since')) {
    el.textContent = formatSince(Number(el.dataset.since), now);
  }
}

// Demo: con ?demo, o publicado en GitHub Pages (no hay agente ahí).
const demo = new URLSearchParams(location.search).has('demo') || location.hostname.endsWith('github.io');

function connect() {
  if (demo) {
    setLink('ok', 'demo');
    firstClaudeEvent = false;
    return startDemo(handlers);
  }
  if (!token) return setLink('error', 'falta el token: abrí el link que imprime el agente');
  const es = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
  for (const topic of Object.keys(handlers)) {
    es.addEventListener(topic, (e) => handlers[topic](JSON.parse(e.data)));
  }
  es.onopen = () => setLink('ok', 'conectado');
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) setLink('error', 'token inválido');
    else setLink('connecting', 'reconectando…');
  };
}
renderSessions([]);
drawBars(new Array(24).fill(0));
connect();

$('arm').addEventListener('click', async () => {
  await arm();
  $('arm').hidden = true;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
