import { formatTime, formatDate, formatSince, isHot, alertFor, readToken } from './format.js';
import { arm, notify } from './alerts.js';

const $ = (id) => document.getElementById(id);
const token = readToken(location.search, localStorage.getItem('deskpanel.token'));
if (token) {
  localStorage.setItem('deskpanel.token', token);
  history.replaceState(null, '', location.pathname); // el token no queda en la barra
}

function setLink(state, text) {
  $('link').dataset.state = state;
  $('link').textContent = text;
}

function tickClock() {
  const now = new Date();
  $('time').textContent = formatTime(now);
  $('date').textContent = formatDate(now);
  renderSessionAges();
}
setInterval(tickClock, 1000);
tickClock();

const handlers = {
  system(d) {
    $('host').textContent = d.host;
    $('cpuArc').style.strokeDasharray = `${d.cpu} 100`;
    $('cpuArc').dataset.hot = String(isHot(d.cpu));
    $('cpuValue').textContent = `${d.cpu}%`;
    $('memFill').style.width = `${d.mem.percent}%`;
    $('memText').textContent = `${d.mem.usedGb} / ${d.mem.totalGb} GB`;
  },
  weather(d) {
    $('weatherCell').hidden = false;
    $('weatherTemp').textContent = `${d.temp}°`;
    $('weatherText').textContent = `${d.name ?? ''} · ${d.text}`;
  },
  claude(d) {
    renderSessions(d.sessions);
    const kind = alertFor(d.last);
    if (kind && !firstClaudeEvent) notify(kind, $('flash'));
    firstClaudeEvent = false;
  },
};
let firstClaudeEvent = true; // el estado inicial al conectar no dispara alertas

let sessions = [];
function renderSessions(list) {
  sessions = list;
  const ul = $('sessions');
  ul.replaceChildren();
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin sesiones activas';
    ul.append(li);
    return;
  }
  for (const s of list) {
    const li = document.createElement('li');
    const lamp = Object.assign(document.createElement('span'), { className: 'lamp' });
    lamp.dataset.state = s.state;
    const name = Object.assign(document.createElement('span'), { className: 's-name', textContent: s.project });
    const age = Object.assign(document.createElement('span'), { className: 's-since' });
    age.dataset.since = s.since;
    li.append(lamp, name, age);
    if (s.message) {
      li.append(Object.assign(document.createElement('span'), { className: 's-msg', textContent: s.message }));
    }
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

function connect() {
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
connect();

$('arm').addEventListener('click', async () => {
  await arm();
  $('arm').hidden = true;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
