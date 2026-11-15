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

export const HISTORY_MAX = 120;

export function pushHistory(arr, value, max = HISTORY_MAX) {
  arr.push(value);
  if (arr.length > max) arr.shift();
  return arr;
}

export function startMetrics(bus, intervalMs = 2000) {
  const hist = { cpu: [], mem: [] };
  let prev = sample();
  const tick = () => {
    const next = sample();
    const cpu = cpuPercent(prev, next);
    const mem = memoryInfo();
    pushHistory(hist.cpu, cpu);
    pushHistory(hist.mem, mem.percent);
    bus.publish('system', {
      cpu,
      mem,
      host: os.hostname(),
      uptimeMin: Math.round(os.uptime() / 60),
      hist: { cpu: [...hist.cpu], mem: [...hist.mem] },
    });
    prev = next;
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
