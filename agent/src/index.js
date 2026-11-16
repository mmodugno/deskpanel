import { loadConfig } from './config.js';
import { loadOrCreateToken } from './token-store.js';
import { pairUrls } from './pair.js';
import { execFile } from 'node:child_process';
import { createBus } from './bus.js';
import { createSessions } from './claude-sessions.js';
import { createServer } from './server.js';
import { createPermissions } from './permissions.js';
import { startFocus } from './focus.js';
import { startGithub } from './github.js';
import { startCalendar } from './calendar.js';
import { createMedia, startMedia } from './media.js';
import { startMetrics } from './metrics.js';
import { startWeather } from './weather.js';
import { lanAddresses } from './network.js';

const usb = process.argv.includes('--usb');
const cfg = loadConfig();
if (usb) cfg.host = '127.0.0.1'; // solo local: el celular entra por adb reverse

const { token, created } = loadOrCreateToken();
const bus = createBus();
const sessions = createSessions();
const permissions = createPermissions({
  timeoutMs: cfg.permissionTimeoutMs,
  onChange: (pending) => bus.publish('permissions', { pending }),
});
const focus = startFocus(bus, cfg.focus);
const media = createMedia();
startMedia(bus, media);
const pairing = {
  urls: () => pairUrls(lanAddresses(), cfg.port, token),
  usbUrl: () => `http://localhost:${cfg.port}/?token=${token}`,
};
const server = createServer({ token, bus, sessions, permissions, focus, media, pairing });

startMetrics(bus, cfg.metricsIntervalMs);
startWeather(bus, cfg.weather);
startGithub(bus, cfg.github);
startCalendar(bus, cfg.calendarUrl);
bus.publish('permissions', { pending: [] });
bus.publish('claude', { sessions: [], activity: sessions.activity(), last: null });

server.listen(cfg.port, cfg.host, () => {
  console.log('deskpanel listo\n');
  if (usb) {
    console.log(`  Modo USB (solo localhost). Conectá el celular y corré:`);
    console.log(`    adb reverse tcp:${cfg.port} tcp:${cfg.port}`);
    console.log(`  Abrí en el celular: http://localhost:${cfg.port}/?token=${token}`);
  } else {
    for (const ip of lanAddresses()) {
      console.log(`  Abrí en el celular/tablet: http://${ip}:${cfg.port}/?token=${token}`);
    }
  }
  console.log(`\n  Emparejar un dispositivo: http://localhost:${cfg.port}/pair`);
  console.log(`  Hook de Claude Code: ver docs/claude-code.md`);

  // La primera vez (o con --open) abre la página para conectar el celular.
  if (created || process.argv.includes('--open')) openInBrowser(`http://localhost:${cfg.port}/pair`);
});

function openInBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  execFile(cmd, args, () => {}); // si falla, el link ya está impreso en la consola
}

const stop = () => {
  bus.closeAll();
  server.close(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
