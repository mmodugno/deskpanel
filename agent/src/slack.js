// Menciones y mensajes directos sin leer de Slack, con un token de usuario (xoxp-...).
// Solo lectura: el agente únicamente llama a los métodos de READ_ONLY, aunque el token tenga más permisos.
// Permisos que necesita la app de Slack: search:read, im:read, mpim:read, im:history, mpim:history, users:read.
export const READ_ONLY = new Set([
  'auth.test',
  'search.messages',
  'users.conversations',
  'conversations.info',
  'conversations.history',
  'users.info',
]);

const MAX_DMS = 30; // conversaciones directas revisadas por ronda (límite de la API)

export function slackClient(token, fetchImpl = fetch) {
  return async function call(method, params = {}) {
    if (!READ_ONLY.has(method)) throw new Error(`Método de Slack no permitido (solo lectura): ${method}`);
    const qs = new URLSearchParams(params);
    const res = await fetchImpl(`https://slack.com/api/${method}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Slack respondió ${res.status} en ${method}`);
    const body = await res.json();
    if (!body.ok) throw new Error(`Slack: ${body.error ?? 'error'} en ${method}`);
    return body;
  };
}

// Texto de Slack a texto plano: <@U1|ana> → @ana, <url|etiqueta> → etiqueta, <#C1|canal> → #canal.
export function cleanText(text, names = new Map()) {
  return String(text ?? '')
    .replace(/<@([A-Z0-9]+)(?:\|([^>]+))?>/g, (_, id, label) => `@${label ?? names.get(id) ?? 'alguien'}`)
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, '#$1')
    .replace(/<!(here|channel|everyone)>/g, '@$1')
    .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<([^>]+)>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

// Fecha de ayer en formato AAAA-MM-DD: "after:<ayer>" en la búsqueda de Slack = desde hoy.
export function yesterday(now) {
  const d = new Date(now - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createSlack({ token, fetchImpl = fetch, now = () => Date.now() }) {
  const call = slackClient(token, fetchImpl);
  const names = new Map();
  let me = null;

  async function userName(id) {
    if (!id) return 'alguien';
    if (!names.has(id)) {
      try {
        const { user } = await call('users.info', { user: id });
        names.set(id, user?.profile?.display_name || user?.real_name || user?.name || 'alguien');
      } catch {
        names.set(id, 'alguien');
      }
    }
    return names.get(id);
  }

  async function unreadIn(ch) {
    const { channel } = await call('conversations.info', { channel: ch.id });
    if (Number.isFinite(channel?.unread_count_display)) return channel.unread_count_display;
    if (!channel?.last_read) return 0;
    const { messages = [] } = await call('conversations.history', { channel: ch.id, oldest: channel.last_read, limit: '20' });
    return messages.filter((m) => m.user && m.user !== me).length;
  }

  return async function refresh() {
    if (!me) {
      const auth = await call('auth.test');
      me = auth.user_id;
      names.set(me, auth.user || 'vos');
    }

    const search = await call('search.messages', {
      query: `<@${me}> after:${yesterday(now())}`, sort: 'timestamp', sort_dir: 'desc', count: '5',
    });
    const matches = search.messages?.matches ?? [];
    const mentions = [];
    for (const m of matches.slice(0, 5)) {
      mentions.push({
        from: m.username || (await userName(m.user)),
        where: m.channel?.is_im ? 'mensaje directo' : `#${m.channel?.name ?? 'canal'}`,
        text: cleanText(m.text, names),
        ts: Math.round(Number(m.ts) * 1000),
      });
    }

    const { channels = [] } = await call('users.conversations', { types: 'im,mpim', exclude_archived: 'true', limit: '200' });
    const dms = [];
    for (const ch of channels.slice(0, MAX_DMS)) {
      const count = await unreadIn(ch).catch(() => 0);
      if (count > 0) dms.push({ from: ch.is_im ? await userName(ch.user) : cleanText(ch.name), count });
    }
    dms.sort((a, b) => b.count - a.count);

    return {
      mentionsToday: search.messages?.paging?.total ?? search.messages?.total ?? matches.length,
      mentions,
      unreadDms: dms.reduce((n, d) => n + d.count, 0),
      dms: dms.slice(0, 4),
    };
  };
}

export function startSlack(bus, token, { everyMs = 2 * 60 * 1000 } = {}) {
  if (!token) return () => {};
  const refresh = createSlack({ token });
  const tick = () => refresh()
    .then((data) => bus.publish('slack', data))
    .catch((e) => bus.publish('slack', { error: String(e.message).slice(0, 120) }));
  const timer = setInterval(tick, everyMs);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
