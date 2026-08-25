import http from 'node:http';

export function createWebhookSource({ channels, webhook, emit }) {
  const known = new Set(channels.map((c) => c.id));
  let server = null;

  function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const match = url.pathname.match(/^\/notify\/([^/]+)$/);
      if (req.method !== 'POST' || !match) {
        res.writeHead(404).end();
        return;
      }
      if (webhook.token) {
        const auth = req.headers['authorization'] || '';
        if (auth !== `Bearer ${webhook.token}`) {
          res.writeHead(401).end();
          return;
        }
      }
      const id = decodeURIComponent(match[1]);
      if (!known.has(id)) {
        res.writeHead(404).end();
        return;
      }
      // drain body then respond
      req.resume();
      req.on('end', () => {
        emit(id);
        res.writeHead(204).end();
      });
    } catch {
      // malformed URL or bad percent-encoding; never crash the process
      res.writeHead(400).end();
    }
  }

  function start() {
    return new Promise((resolve) => {
      server = http.createServer(handler);
      server.on('clientError', (err, socket) => {
        if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      });
      server.listen(webhook.port, webhook.host, () => resolve(server.address().port));
    });
  }

  function stop() {
    if (server) server.close();
    server = null;
  }

  return { start, stop };
}
