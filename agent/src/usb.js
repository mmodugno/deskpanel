// Modo USB: deja listo `adb reverse` solo, cada vez que se conecta un celular o tablet.
import { execFile } from 'node:child_process';

const defaultExec = (file, args) =>
  new Promise((resolve, reject) =>
    execFile(file, args, { timeout: 8000, windowsHide: true }, (err, stdout, stderr) =>
      err ? reject(Object.assign(err, { stderr })) : resolve(stdout),
    ),
  );

// Dispositivos listos (autorizados) a partir de la salida de `adb devices`.
export function parseDevices(out) {
  return String(out ?? '')
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
}

export function unauthorized(out) {
  return String(out ?? '').split(/\r?\n/).slice(1).some((l) => /\bunauthorized\b/.test(l));
}

export function createUsbWatcher({ port, exec = defaultExec, log = () => {}, everyMs = 3000 }) {
  const ready = new Set();
  let warnedMissing = false;
  let warnedAuth = false;

  async function check() {
    let out;
    try {
      out = await exec('adb', ['devices']);
    } catch (e) {
      if (!warnedMissing) {
        warnedMissing = true;
        log('No encuentro adb. Instalalo (Mac: brew install --cask android-platform-tools) y reiniciá deskpanel.');
      }
      return;
    }
    const devices = parseDevices(out);
    if (unauthorized(out) && !warnedAuth) {
      warnedAuth = true;
      log('Mirá la pantalla del celular: aceptá "¿Permitir la depuración USB?".');
    }
    for (const serial of [...ready]) {
      if (!devices.includes(serial)) {
        ready.delete(serial);
        log(`Dispositivo desconectado: ${serial}`);
      }
    }
    for (const serial of devices) {
      if (ready.has(serial)) continue;
      try {
        await exec('adb', ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
        ready.add(serial);
        warnedAuth = false;
        log(`Dispositivo conectado: ${serial}. Abrí http://localhost:${port}/ en él.`);
      } catch {
        /* se reintenta en el próximo ciclo */
      }
    }
  }

  return {
    check,
    ready: () => [...ready],
    start() {
      const timer = setInterval(check, everyMs);
      timer.unref();
      check();
      return () => clearInterval(timer);
    },
  };
}
