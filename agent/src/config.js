import { readFileSync, existsSync } from 'node:fs';

export const DEFAULTS = {
  port: 4747,
  host: '0.0.0.0',
  metricsIntervalMs: 2000,
  permissionTimeoutMs: 110000, // pasado este tiempo, Claude Code vuelve a preguntar en la terminal
  focus: {}, // { workMin, breakMin, longBreakMin, cycles }
  github: [], // ["usuario/repo", ...]
  calendarUrl: null, // dirección secreta .ics de tu calendario
  weather: null, // { latitude, longitude, name } — solo en config.local.json
  slack: null, // { token: "xoxp-..." } — solo lectura; también sirve SLACK_TOKEN en el entorno
};

export function loadConfig(path = 'config.local.json', env = process.env) {
  let file = {};
  if (existsSync(path)) {
    try {
      file = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      throw new Error(`No pude leer ${path}: el JSON es inválido`);
    }
  }
  const cfg = { ...DEFAULTS, ...file };
  if (env.DESKPANEL_PORT) cfg.port = Number(env.DESKPANEL_PORT);
  if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) {
    throw new Error(`Puerto inválido: ${cfg.port}`);
  }
  return cfg;
}
