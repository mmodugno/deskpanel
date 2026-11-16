import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { createToken } from './auth.js';

export function defaultTokenPath() {
  return join(homedir(), '.deskpanel', 'token');
}

// El token se guarda para que el celular siga emparejado después de reiniciar la PC.
export function loadOrCreateToken(path = defaultTokenPath(), env = process.env) {
  if (env.DESKPANEL_TOKEN) return { token: env.DESKPANEL_TOKEN, created: false };
  if (existsSync(path)) {
    const saved = readFileSync(path, 'utf8').trim();
    if (/^[a-f0-9]{32}$/.test(saved)) return { token: saved, created: false };
  }
  const token = createToken();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, token + '\n', { mode: 0o600 });
  return { token, created: true };
}
