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
