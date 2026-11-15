// Modo demo: genera datos de mentira en el navegador para mostrar el panel
// sin agente (por ejemplo en GitHub Pages). No usa ningún dato real.
export function nextCpu(prev, rnd = Math.random) {
  const step = (rnd() - 0.5) * 24;
  return Math.round(Math.max(4, Math.min(96, prev + step)));
}

const FLOW = ['working', 'waiting', 'done', 'working'];

export function nextState(state) {
  return FLOW[(FLOW.indexOf(state) + 1) % FLOW.length];
}

export function startDemo(handlers) {
  let cpu = 32;
  const hist = { cpu: [], mem: [] };
  const activity = new Array(24).fill(0);
  [9, 10, 11, 14, 15, 16, 17].forEach((h, i) => { activity[h] = [2, 5, 3, 4, 7, 6, 2][i]; });
  const t0 = Date.now();
  const sessions = [
    { id: 'a', project: 'api-notas', state: 'working', message: '', since: t0 },
    { id: 'b', project: 'mi-app', state: 'done', message: '', since: t0 - 4 * 60000 },
  ];
  const MESSAGES = { waiting: 'Claude necesita tu permiso para ejecutar un comando' };

  handlers.weather({ name: 'Mi ciudad', temp: 22, text: 'Poco nublado' });
  const sendSystem = () => {
    cpu = nextCpu(cpu);
    const percent = Math.round(38 + cpu / 6);
    hist.cpu.push(cpu);
    hist.mem.push(percent);
    if (hist.cpu.length > 120) { hist.cpu.shift(); hist.mem.shift(); }
    handlers.system({
      cpu, host: 'mi-pc (demo)', uptimeMin: 300,
      mem: { totalGb: 16, usedGb: Math.round(percent * 0.16 * 10) / 10, percent },
      hist: { cpu: [...hist.cpu], mem: [...hist.mem] },
    });
  };
  const sendSystemSilent = () => {
    cpu = nextCpu(cpu);
    hist.cpu.push(cpu);
    hist.mem.push(Math.round(38 + cpu / 6));
  };
  const sendClaude = (changed = false, state = null) =>
    handlers.claude({ sessions: [...sessions], activity: [...activity], last: { changed, state } });

  for (let i = 0; i < 60; i++) sendSystemSilent();
  sendSystem();
  sendClaude();
  setInterval(sendSystem, 1500);

  // Cada tanto aparece un pedido de permiso de mentira para probar los botones.
  let pending = [];
  const DEMO_COMMANDS = [
    ['Bash', 'git push origin main --force-with-lease'],
    ['Bash', 'npm install --save-dev playwright'],
    ['Edit', 'src/engine/planner.js'],
  ];
  let n = 0;
  const publish = () => handlers.permissions({ pending: [...pending] });
  const ask = () => {
    if (pending.length) return;
    const [tool, detail] = DEMO_COMMANDS[n++ % DEMO_COMMANDS.length];
    const since = Date.now();
    pending.push({ id: `demo-${n}`, project: 'api-notas', tool, detail, since, expiresAt: since + 110000 });
    publish();
  };
  publish();
  setTimeout(ask, 6000);
  setInterval(ask, 30000);
  setInterval(() => {
    const s = sessions[0];
    s.state = nextState(s.state);
    s.message = MESSAGES[s.state] ?? '';
    s.since = Date.now();
    if (s.state === 'working') activity[new Date().getHours()] += 1;
    sendClaude(true, s.state);
  }, 7000);

  // ---- Foco (simulado en el navegador) ----
  const WORK = 25 * 60000;
  const BREAK = 5 * 60000;
  const f = { phase: 'work', running: false, remainingMs: WORK - 4 * 60000, endsAt: null, cycle: 1, today: 3, transitions: 0, totalMs: WORK, config: { cycles: 4 } };
  const sendFocus = () => handlers.focus({ ...f });
  const setPhase = (phase) => {
    f.phase = phase;
    f.totalMs = phase === 'work' ? WORK : BREAK;
    f.remainingMs = f.totalMs;
    f.running = false;
    f.endsAt = null;
  };
  const focusAct = (action) => {
    if (action === 'start' && !f.running) {
      f.running = true;
      f.endsAt = Date.now() + f.remainingMs;
    } else if (action === 'pause' && f.running) {
      f.remainingMs = Math.max(0, f.endsAt - Date.now());
      f.running = false;
      f.endsAt = null;
    } else if (action === 'reset') {
      f.cycle = 0;
      setPhase('work');
    } else if (action === 'skip') {
      setPhase(f.phase === 'work' ? 'break' : 'work');
    }
    sendFocus();
  };
  setInterval(() => {
    if (f.running && Date.now() >= f.endsAt) {
      if (f.phase === 'work') { f.today += 1; f.cycle = Math.min(4, f.cycle + 1); }
      f.transitions += 1;
      setPhase(f.phase === 'work' ? 'break' : 'work');
      sendFocus();
    }
  }, 500);
  sendFocus();

  // ---- Música (canciones inventadas) ----
  const TRACKS = [
    { title: 'Luces de la ciudad', artist: 'Estudio Nocturno', album: 'Madrugada' },
    { title: 'Café con ruido blanco', artist: 'Lofi Taller', album: 'Sesiones' },
    { title: 'Mapa de estrellas', artist: 'Aurora Digital', album: 'Órbita' },
  ];
  let track = 0;
  let playing = true;
  const sendMedia = () => handlers.media({ playing, ...TRACKS[track], status: playing ? 'playing' : 'paused' });
  const mediaAct = (action) => {
    if (action === 'play-pause') playing = !playing;
    else track = (track + (action === 'next' ? 1 : TRACKS.length - 1)) % TRACKS.length;
    sendMedia();
  };
  sendMedia();

  // ---- Calendario y GitHub (datos de mentira) ----
  const at = (min) => Date.now() + min * 60000;
  const tomorrow9 = new Date(); tomorrow9.setDate(tomorrow9.getDate() + 1); tomorrow9.setHours(9, 0, 0, 0);
  handlers.calendar({
    events: [
      { title: 'Reunión de equipo', start: at(40), end: at(70), allDay: false },
      { title: 'Clase de inglés', start: at(150), end: at(210), allDay: false },
      { title: 'Entrega del proyecto', start: tomorrow9.getTime(), end: tomorrow9.getTime() + 3600000, allDay: false },
    ],
  });
  handlers.github({
    repos: [
      { repo: 'tu-usuario/deskpanel', ci: 'success', branch: 'main', prs: 0 },
      { repo: 'tu-usuario/mytempo', ci: 'running', branch: 'feat/plus', prs: 1 },
      { repo: 'tu-usuario/todo-app', ci: 'success', branch: 'main', prs: 0 },
      { repo: 'tu-usuario/pom-app', ci: 'failure', branch: 'main', prs: 2 },
    ],
  });

  return {
    api(path, body) {
      if (path === 'permission/answer') {
        pending = pending.filter((p) => p.id !== body.id);
        publish();
      } else if (path === 'focus') focusAct(body.action);
      else if (path === 'media') mediaAct(body.action);
    },
  };
}
