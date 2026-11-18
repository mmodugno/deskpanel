import { win32 } from 'node:path';

// Estado de las sesiones de Claude Code a partir de sus hooks.
const STATE_BY_EVENT = {
  UserPromptSubmit: 'working',
  PreToolUse: 'working',
  PostToolUse: 'working',
  Notification: 'waiting',
  Stop: 'done',
};

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

export function projectName(cwd) {
  const name = win32.basename(clip(cwd, 500).replace(/[\\/]+$/, ''));
  return name || 'sesión';
}

// Qué está haciendo Claude, en pocas palabras, a partir de la herramienta que va a usar.
export function describeTool(name, input) {
  const tool = clip(name, 80);
  const i = input && typeof input === 'object' ? input : {};
  const file = () => projectName(i.file_path ?? i.notebook_path ?? i.path);
  const line = (v) => clip(v, 400).split(/\r?\n/)[0].slice(0, 80);
  switch (tool) {
    case 'Bash':
    case 'PowerShell':
      return `$ ${line(i.command)}`;
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return `editando ${file()}`;
    case 'Write':
      return `escribiendo ${file()}`;
    case 'Read':
      return `leyendo ${file()}`;
    case 'Grep':
    case 'Glob':
      return `buscando ${line(i.pattern)}`;
    case 'WebSearch':
      return `buscando en la web: ${line(i.query)}`;
    case 'WebFetch':
      try {
        return `leyendo ${new URL(clip(i.url, 500)).hostname}`;
      } catch {
        return 'leyendo una página';
      }
    case 'Task':
    case 'Agent':
      return `subagente: ${line(i.description) || 'trabajando'}`;
    case 'TodoWrite':
      return 'actualizando la lista de tareas';
  }
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool);
  if (mcp) return `${mcp[2]} (${mcp[1]})`;
  return tool || 'trabajando';
}

export function createSessions(now = () => Date.now()) {
  const sessions = new Map();
  // Cuántas veces empezó a trabajar una sesión en cada hora del día de hoy.
  let activity = new Array(24).fill(0);
  let activityDay = new Date(now()).toDateString();

  function bump() {
    const d = new Date(now());
    if (d.toDateString() !== activityDay) {
      activity = new Array(24).fill(0);
      activityDay = d.toDateString();
    }
    activity[d.getHours()] += 1;
  }

  return {
    apply(payload) {
      const event = clip(payload?.hook_event_name, 40);
      const id = clip(payload?.session_id, 80);
      if (!event || !id) return null;

      if (event === 'SessionEnd') {
        sessions.delete(id);
        return { event, changed: true };
      }
      const state = STATE_BY_EVENT[event];
      if (!state) return null;

      const prev = sessions.get(id);
      const changed = !prev || prev.state !== state;
      if (changed && state === 'working') bump();
      // Una tarea arranca con el prompt (o con la primera herramienta después de un Stop)
      // y dura hasta el Stop; pedir permiso en el medio no la corta.
      const newTask = state === 'working' && (event === 'UserPromptSubmit' || !prev || prev.state === 'done');
      const startedAt = newTask ? now() : (prev?.startedAt ?? now());
      sessions.set(id, {
        id,
        project: projectName(payload.cwd),
        state,
        message: state === 'waiting' ? clip(payload.message, 160) : '',
        since: changed ? now() : prev.since,
        prompt: event === 'UserPromptSubmit' ? clip(payload.prompt, 400).replace(/\s+/g, ' ').trim().slice(0, 120) : (prev?.prompt ?? ''),
        doing: event === 'PreToolUse' ? describeTool(payload.tool_name, payload.tool_input)
          : state === 'working' && event !== 'UserPromptSubmit' ? (prev?.doing ?? '') : '',
        startedAt,
        took: state === 'done' ? now() - startedAt : null,
      });
      return { event, state, changed };
    },
    activity() {
      return [...activity];
    },
    list() {
      return [...sessions.values()].sort((a, b) => b.since - a.since);
    },
  };
}
