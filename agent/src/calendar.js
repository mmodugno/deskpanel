// Próximos eventos desde la dirección iCal (.ics) secreta de tu calendario.
// Soporta fechas UTC, con zona horaria, de día completo y repeticiones diarias/semanales simples.
const DAY = 86400000;

export function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

function tzOffset(ts, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(ts));
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(ts / 1000) * 1000;
}

export function zonedToUtc(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ts = guess - tzOffset(guess, tz);
  ts = guess - tzOffset(ts, tz); // segunda pasada por los cambios de horario
  return ts;
}

export function parseDate(params, value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', , z] = m;
  const allDay = params.includes('VALUE=DATE') || m[4] === undefined;
  if (z) return { ts: Date.UTC(+y, +mo - 1, +d, +h, +mi), allDay: false };
  const tz = /TZID=([^;:]+)/.exec(params)?.[1];
  if (tz) {
    try {
      return { ts: zonedToUtc(+y, +mo, +d, +h, +mi, tz), allDay };
    } catch {
      /* zona desconocida: cae a hora local */
    }
  }
  return { ts: new Date(+y, +mo - 1, +d, +h, +mi).getTime(), allDay };
}

const unescape = (s) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');

export function parseIcs(text) {
  const events = [];
  let cur = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur?.start) events.push(cur);
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const [name, ...rest] = line.slice(0, i).split(';');
      const params = rest.join(';');
      const value = line.slice(i + 1);
      if (name === 'SUMMARY') cur.title = unescape(value);
      else if (name === 'DTSTART') {
        const d = parseDate(params, value);
        if (d) { cur.start = d.ts; cur.allDay = d.allDay; }
      } else if (name === 'DTEND') {
        const d = parseDate(params, value);
        if (d) cur.end = d.ts;
      } else if (name === 'RRULE') cur.rrule = Object.fromEntries(value.split(';').map((kv) => kv.split('=')));
      else if (name === 'STATUS' && value === 'CANCELLED') cur.cancelled = true;
    }
  }
  return events.filter((e) => !e.cancelled);
}

const BYDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// Ocurrencias de un evento entre `from` y `to`.
export function occurrences(ev, from, to) {
  const dur = (ev.end ?? ev.start) - ev.start;
  const out = [];
  const push = (start) => {
    if (start + dur >= from && start <= to) out.push({ title: ev.title || '(sin título)', start, end: start + dur, allDay: !!ev.allDay });
  };
  const r = ev.rrule;
  if (!r || !['DAILY', 'WEEKLY'].includes(r.FREQ)) {
    push(ev.start);
    return out;
  }
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const until = r.UNTIL ? parseDate('', r.UNTIL)?.ts ?? Infinity : Infinity;
  const days = r.BYDAY ? r.BYDAY.split(',').map((d) => BYDAY[d.slice(-2)]).filter((n) => n !== undefined) : null;
  const t0 = new Date(ev.start);
  const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  for (let day = startOfDay(Math.max(from - dur, ev.start)); day <= to; day += DAY) {
    const d = new Date(day);
    const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t0.getHours(), t0.getMinutes()).getTime();
    if (slot < ev.start || slot > until) continue;
    const daysSince = Math.round((startOfDay(slot) - startOfDay(ev.start)) / DAY);
    if (r.FREQ === 'DAILY') {
      if (daysSince % interval === 0) push(slot);
    } else {
      const weeks = Math.floor(daysSince / 7);
      const okDay = days ? days.includes(d.getDay()) : d.getDay() === t0.getDay();
      if (okDay && weeks % interval === 0) push(slot);
    }
  }
  return out;
}

export function upcoming(events, now, horizonMs = 7 * DAY, limit = 4) {
  return events
    .flatMap((e) => occurrences(e, now, now + horizonMs))
    .filter((o) => o.end >= now)
    .sort((a, b) => a.start - b.start)
    .slice(0, limit);
}

export async function fetchCalendar(url, { fetchImpl = fetch, now = Date.now() } = {}) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`El calendario respondió ${res.status}`);
  return upcoming(parseIcs(await res.text()), now);
}

export function startCalendar(bus, url, everyMs = 10 * 60 * 1000) {
  if (!url) return () => {};
  const refresh = () => fetchCalendar(url).then((events) => bus.publish('calendar', { events })).catch(() => {});
  const timer = setInterval(refresh, everyMs);
  timer.unref();
  refresh();
  return () => clearInterval(timer);
}
