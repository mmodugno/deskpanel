import { formatTime, formatDate, formatSince, isHot, alertFor, readToken, greetingFor, isNight, STATE_LABEL, arcDash, sparkPath, barHeights, THEMES, nextTheme, themeName, timeLeft, permissionTitle, formatUptime, rangeText,
  PHASE_LABEL, focusRemaining, clockMs, focusProgress, primaryLabel, eventTime, relativeStart, CI_LABEL, prLabel } from './format.js';
import { arm, notify } from './alerts.js';
import { startDemo } from './demo.js';

const $ = (id) => document.getElementById(id);
// El almacenamiento puede estar bloqueado (modo privado, iframes): no debe romper el panel.
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
function applyTheme(id) {
  const valid = THEMES.some((t) => t.id === id) ? id : THEMES[0].id;
  document.documentElement.dataset.theme = valid;
  $('themeName').textContent = themeName(valid);
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  store.set('deskpanel.theme', valid);
}
$('theme').addEventListener('click', () => applyTheme(nextTheme(document.documentElement.dataset.theme)));
const token = readToken(location.search, store.get('deskpanel.token'));
if (token) {
  store.set('deskpanel.token', token);
  history.replaceState(null, '', location.pathname); // el token no queda en la barra
}
applyTheme(store.get('deskpanel.theme'));

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
    $('uptimeBig').textContent = formatUptime(d.uptimeMin);
    $('hostSub').textContent = d.host;
    if (d.hist) {
      drawChart(d.hist);
      $('memSparkPath').setAttribute('d', sparkPath(d.hist.mem, 120, 30).line);
      $('cpuRange').textContent = rangeText(d.hist.cpu);
    }
  },
  weather(d) {
    $('weatherTemp').textContent = `${d.temp}°`;
    $('weatherText').textContent = [d.name, d.text].filter(Boolean).join(' · ');
  },
  focus(d) {
    const first = focusState === null;
    if (!first && d.transitions > focusState.transitions) notify('focus', $('flash'));
    focusState = d;
    renderFocus();
  },
  media(d) {
    const idle = !d.title;
    const box = $('musicTitle').closest('.music');
    box.dataset.idle = String(idle);
    box.dataset.playing = String(!!d.playing);
    $('musicTitle').textContent = idle ? 'Nada sonando' : d.title;
    $('musicArtist').textContent = idle ? '' : [d.artist, d.album].filter(Boolean).join(' · ');
    $('mPlayIcon').innerHTML = d.playing
      ? '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/>'
      : '<path d="M8 5v14l11-7z" fill="currentColor"/>';
  },
  calendar(d) {
    calendarEvents = d.events;
    renderCalendar();
  },
  github(d) {
    renderRepos(d.repos);
  },
  permissions(d) {
    const seen = new Set(shownPermissions);
    renderPermission(d.pending);
    if (d.pending.some((p) => !seen.has(p.id))) notify('permission', $('flash'));
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

let focusState = null;
let calendarEvents = null;
let shownPermissions = [];
let currentPerm = null;

async function api(path, body) {
  try {
    if (demoCtl) return demoCtl.api(path, body);
    await fetch(`/api/${path}?token=${encodeURIComponent(token)}`, { method: 'POST', body: JSON.stringify(body) });
  } catch {}
}
const decide = (id, behavior) => api('permission/answer', { id, behavior });

function renderPermission(pending) {
  shownPermissions = pending.map((p) => p.id);
  currentPerm = pending[0] ?? null;
  const box = $('perm');
  box.hidden = !currentPerm;
  if (!currentPerm) return;
  $('permTitle').textContent = permissionTitle(currentPerm);
  $('permDetail').textContent = currentPerm.detail;
  $('permCount').hidden = pending.length < 2;
  $('permCount').textContent = `+${pending.length - 1} más`;
}

setInterval(() => {
  if (currentPerm) $('permTimer').style.transform = `scaleX(${timeLeft(currentPerm, Date.now())})`;
}, 250);
$('permAllow').addEventListener('click', () => currentPerm && decide(currentPerm.id, 'allow'));
$('permDeny').addEventListener('click', () => currentPerm && decide(currentPerm.id, 'deny'));

function renderFocus() {
  const f = focusState;
  if (!f) return;
  const now = Date.now();
  $('focusTime').textContent = clockMs(focusRemaining(f, now));
  $('focusArc').style.strokeDasharray = `${(focusProgress(f, now) * 100).toFixed(1)} 100`;
  $('phaseLabel').textContent = PHASE_LABEL[f.phase] ?? f.phase;
  $('focusPrimary').textContent = primaryLabel(f, now);
  $('focusToday').textContent = `Hoy: ${f.today} ${f.today === 1 ? 'pomodoro' : 'pomodoros'}`;
  $('focusPrimary').closest('.focus').dataset.phase = f.phase;
  const dotsEl = $('focusDots');
  const total = f.config?.cycles ?? 4;
  if (dotsEl.children.length !== total) dotsEl.replaceChildren(...Array.from({ length: total }, () => document.createElement('i')));
  [...dotsEl.children].forEach((d, i) => d.classList.toggle('on', i < f.cycle));
}
setInterval(renderFocus, 250);
$('focusPrimary').addEventListener('click', () => api('focus', { action: focusState?.running ? 'pause' : 'start' }));
$('focusReset').addEventListener('click', () => api('focus', { action: 'reset' }));
$('focusSkip').addEventListener('click', () => api('focus', { action: 'skip' }));
$('mPrev').addEventListener('click', () => api('media', { action: 'previous' }));
$('mPlay').addEventListener('click', () => api('media', { action: 'play-pause' }));
$('mNext').addEventListener('click', () => api('media', { action: 'next' }));

function renderCalendar() {
  if (!calendarEvents) return;
  const main = $('calMain');
  const more = $('calMore');
  main.replaceChildren();
  more.replaceChildren();
  const now = Date.now();
  const upcoming = calendarEvents.filter((e) => e.end >= now);
  if (!upcoming.length) {
    main.append(el('div', 'empty', 'Sin eventos próximos'));
    return;
  }
  const [first, ...rest] = upcoming;
  main.append(el('div', 'cal-title', first.title), el('div', 'cal-when', `${relativeStart(first, now)} · ${eventTime(first)}`));
  for (const e of rest.slice(0, 3)) {
    const li = el('li');
    li.append(el('span', '', e.title), el('span', '', `${relativeStart(e, now)} · ${eventTime(e)}`));
    more.append(li);
  }
}
setInterval(renderCalendar, 30000);

function renderRepos(repos) {
  const ul = $('repos');
  ul.replaceChildren();
  if (!repos.length) {
    ul.append(el('li', 'empty', 'Sumá tus repos en config.local.json'));
    return;
  }
  for (const r of repos) {
    const li = el('li', 'repo');
    li.dataset.ci = r.ci;
    li.append(document.createElement('i'), el('span', 'repo-name', r.repo), el('span', `repo-prs${r.prs ? '' : ' zero'}`, prLabel(r.prs)));
    li.append(el('span', 'repo-ci', [CI_LABEL[r.ci] ?? r.ci, r.branch].filter(Boolean).join(' · ')));
    ul.append(li);
  }
}

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
let demoCtl = null;
const demo = new URLSearchParams(location.search).has('demo') || location.hostname.endsWith('github.io');

function connect() {
  if (demo) {
    setLink('ok', 'demo');
    firstClaudeEvent = false;
    demoCtl = startDemo(handlers);
    return;
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
  try { await document.documentElement.requestFullscreen?.(); } catch {} // pantalla completa donde se pueda
  $('arm').hidden = true;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Páginas deslizables: los puntitos siguen el scroll y también navegan.
const pagesEl = $('pages');
const dots = [...document.querySelectorAll('#dots button')];
pagesEl.addEventListener('scroll', () => {
  const i = Math.round(pagesEl.scrollLeft / pagesEl.clientWidth);
  dots.forEach((d, n) => d.classList.toggle('on', n === i));
}, { passive: true });
dots.forEach((d, n) => d.addEventListener('click', () => pagesEl.scrollTo({ left: n * pagesEl.clientWidth, behavior: 'smooth' })));
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') pagesEl.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * pagesEl.clientWidth, behavior: 'smooth' });
});
