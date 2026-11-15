import { formatTime, formatDate, formatSince, isHot, alertFor, readToken, greetingFor, isNight, STATE_LABEL, arcDash } from './format.js';
import { arm, notify } from './alerts.js';

const $ = (id) => document.getElementById(id);
const token = readToken(location.search, localStorage.getItem('deskpanel.token'));
if (token) {
  localStorage.setItem('deskpanel.token', token);
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
  },
  weather(d) {
    $('weatherCell').hidden = false;
    $('weatherTemp').textContent = `${d.temp}°`;
    $('weatherText').textContent = [d.name, d.text].filter(Boolean).join(' · ');
  },
  claude(d) {
    renderSessions(d.sessions);
    const kind = alertFor(d.last);
    if (kind && !firstClaudeEvent) notify(kind, $('flash'));
    firstClaudeEvent = false;
  },
};
let firstClaudeEvent = true; // el estado inicial al conectar no dispara alertas

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
renderSessions([]);
connect();

$('arm').addEventListener('click', async () => {
  await arm();
  $('arm').hidden = true;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
