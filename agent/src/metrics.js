import os from 'node:os';

function sample() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const v of Object.values(c.times)) total += v;
    idle += c.times.idle;
  }
  return { idle, total };
}

export function cpuPercent(prev, next) {
  const dTotal = next.total - prev.total;
  if (dTotal <= 0) return 0;
  const used = 1 - (next.idle - prev.idle) / dTotal;
  return Math.max(0, Math.min(100, Math.round(used * 100)));
}

export function memoryInfo(total = os.totalmem(), free = os.freemem()) {
  const used = total - free;
  return {
    totalGb: Math.round((total / 1024 ** 3) * 10) / 10,
    usedGb: Math.round((used / 1024 ** 3) * 10) / 10,
    percent: total ? Math.round((used / total) * 100) : 0,
  };
}

export function startMetrics(bus, intervalMs = 2000) {
  let prev = sample();
  const tick = () => {
    const next = sample();
    bus.publish('system', {
      cpu: cpuPercent(prev, next),
      mem: memoryInfo(),
      host: os.hostname(),
      uptimeMin: Math.round(os.uptime() / 60),
    });
    prev = next;
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
