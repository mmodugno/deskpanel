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
    handlers.system({
      cpu, host: 'mi-pc (demo)', uptimeMin: 300,
      mem: { totalGb: 16, usedGb: Math.round(percent * 0.16 * 10) / 10, percent },
    });
  };
  const sendClaude = (changed = false, state = null) =>
    handlers.claude({ sessions: [...sessions], last: { changed, state } });

  sendSystem();
  sendClaude();
  setInterval(sendSystem, 1500);
  setInterval(() => {
    const s = sessions[0];
    s.state = nextState(s.state);
    s.message = MESSAGES[s.state] ?? '';
    s.since = Date.now();
    sendClaude(true, s.state);
  }, 7000);
}
