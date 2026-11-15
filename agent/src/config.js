import { readFileSync, existsSync } from 'node:fs';

export const DEFAULTS = {
  port: 4747,
  host: '0.0.0.0',
  metricsIntervalMs: 2000,
  weather: null, // { latitude, longitude, name } — solo en config.local.json
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
