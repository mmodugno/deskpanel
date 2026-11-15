// Bus de eventos con clientes SSE. Guarda el último valor de cada widget
// para que un panel que se conecta tarde reciba el estado actual enseguida.
export function createBus() {
  const clients = new Set();
  const last = new Map();

  function format(topic, data) {
    return `event: ${topic}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  return {
    publish(topic, data) {
      last.set(topic, data);
      const msg = format(topic, data);
      for (const res of clients) res.write(msg);
    },
    subscribe(res) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      for (const [topic, data] of last) res.write(format(topic, data));
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
    get size() {
      return clients.size;
    },
    snapshot() {
      return Object.fromEntries(last);
    },
    closeAll() {
      for (const res of clients) res.end();
      clients.clear();
    },
  };
}
