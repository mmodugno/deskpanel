import { loadConfig } from './config.js';
import { createToken } from './auth.js';
import { createBus } from './bus.js';
import { createSessions } from './claude-sessions.js';
import { createServer } from './server.js';
import { startMetrics } from './metrics.js';
import { startWeather } from './weather.js';
import { lanAddresses } from './network.js';

const usb = process.argv.includes('--usb');
const cfg = loadConfig();
if (usb) cfg.host = '127.0.0.1'; // solo local: el celular entra por adb reverse

const token = process.env.DESKPANEL_TOKEN || createToken();
const bus = createBus();
const sessions = createSessions();
const server = createServer({ token, bus, sessions });

startMetrics(bus, cfg.metricsIntervalMs);
startWeather(bus, cfg.weather);
bus.publish('claude', { sessions: [], last: null });

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
  console.log(`\n  Hook de Claude Code: ver docs/claude-code.md`);
});

const stop = () => {
  bus.closeAll();
  server.close(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
