import os from 'node:os';

export function lanAddresses(interfaces = os.networkInterfaces()) {
  return Object.values(interfaces)
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}
