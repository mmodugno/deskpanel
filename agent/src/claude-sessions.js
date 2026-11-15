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

export function createSessions(now = () => Date.now()) {
  const sessions = new Map();

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
      sessions.set(id, {
        id,
        project: projectName(payload.cwd),
        state,
        message: state === 'waiting' ? clip(payload.message, 160) : '',
        since: changed ? now() : prev.since,
      });
      return { event, state, changed };
    },
    list() {
      return [...sessions.values()].sort((a, b) => b.since - a.since);
    },
  };
}
