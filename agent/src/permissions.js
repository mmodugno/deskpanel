import { randomUUID } from 'node:crypto';
import { projectName } from './claude-sessions.js';

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

// Resume lo que Claude Code quiere hacer en una línea legible.
export function summarize(toolName, rawInput) {
  const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
  const tool = clip(toolName, 60) || 'Herramienta';
  if (typeof input.command === 'string') return { tool, detail: clip(input.command, 600) };
  if (typeof input.file_path === 'string') return { tool, detail: clip(input.file_path, 300) };
  if (typeof input.url === 'string') return { tool, detail: clip(input.url, 300) };
  if (typeof input.pattern === 'string') return { tool, detail: clip(input.pattern, 300) };
  return { tool, detail: '' };
}

export function hookOutput(behavior) {
  const decision =
    behavior === 'allow'
      ? { behavior: 'allow' }
      : { behavior: 'deny', message: 'Denegado desde deskpanel' };
  return { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } };
}

// Permisos pendientes: la petición HTTP del hook queda abierta hasta que
// alguien responde en el panel o vence el tiempo (entonces Claude Code
// vuelve a preguntar en la terminal como siempre).
export function createPermissions({ onChange = () => {}, timeoutMs = 110_000, now = () => Date.now() } = {}) {
  const pending = new Map();

  const list = () =>
    [...pending.values()].map(({ id, project, tool, detail, since, expiresAt }) => ({
      id, project, tool, detail, since, expiresAt,
    }));

  function finish(id, result) {
    const entry = pending.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.resolve(result);
    onChange(list());
    return true;
  }

  return {
    request(payload) {
      const id = randomUUID();
      const { tool, detail } = summarize(payload?.tool_name, payload?.tool_input);
      return {
        id,
        promise: new Promise((resolve) => {
          const since = now();
          const timer = setTimeout(() => finish(id, null), timeoutMs);
          pending.set(id, {
            id, resolve, timer, since,
            expiresAt: since + timeoutMs,
            project: projectName(payload?.cwd),
            tool, detail,
          });
          onChange(list());
        }),
      };
    },
    answer(id, behavior) {
      if (behavior !== 'allow' && behavior !== 'deny') return false;
      return finish(id, behavior);
    },
    cancel(id) {
      return finish(id, null);
    },
    list,
  };
}
