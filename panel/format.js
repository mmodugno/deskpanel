// Funciones puras del panel (testeables en Node, sin DOM).
export function formatTime(date) {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDate(date) {
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatSince(since, now) {
  const min = Math.floor(Math.max(0, now - since) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h`;
}

export function isHot(cpu) {
  return cpu >= 85;
}

// Un cambio de estado merece alerta solo si la sesión pide permiso o terminó.
export function alertFor(last) {
  if (!last?.changed) return null;
  if (last.state === 'waiting') return 'waiting';
  if (last.state === 'done') return 'done';
  return null;
}

export function readToken(search, stored) {
  const fromUrl = new URLSearchParams(search).get('token');
  return fromUrl || stored || null;
}

export function greetingFor(hour) {
  if (hour >= 6 && hour < 12) return 'Buen día';
  if (hour >= 12 && hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

// De noche el panel baja el brillo para no iluminar el cuarto.
export function isNight(hour) {
  return hour >= 23 || hour < 7;
}

export const STATE_LABEL = { working: 'trabajando', waiting: 'te necesita', done: 'terminó' };

// El anillo de CPU es un arco de 270°: 100% de uso = 75 de 100 del perímetro.
export function arcDash(percent) {
  const p = Math.max(0, Math.min(100, percent));
  return `${(p * 0.75).toFixed(1)} 100`;
}
