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

// Curva suave (Catmull-Rom → Bézier) para un gráfico de línea.
export function sparkPath(values, width, height, min = 0, max = 100) {
  if (!values || values.length < 2) return { line: '', area: '' };
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - ((Math.max(min, Math.min(max, v)) - min) / span) * height,
  ]);
  let line = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    line += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return { line, area };
}

// Alturas (0-100) de las barras de actividad; la mayor ocupa todo el alto.
export function barHeights(counts) {
  const max = Math.max(...counts, 0);
  return counts.map((c) => (max === 0 ? 0 : Math.round((c / max) * 100)));
}
