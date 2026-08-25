import { createServer } from 'node:http';

export function waitForAuthCode({ port = 8421, path = '/oauth2callback', timeoutMs = 120000, onListening } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== path) {
        res.writeHead(404);
        res.end();
        return;
      }
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(error ? 'Authorization failed. You can close this tab.' : 'Authorization complete. You can close this tab.');
      finish(() => (error ? reject(new Error(`Google OAuth consent failed: ${error}`)) : resolve(code)));
    });

    const timer = setTimeout(() => {
      finish(() => reject(new Error(`Timed out after ${timeoutMs}ms waiting for the Google OAuth redirect`)));
    }, timeoutMs);
    if (timer.unref) timer.unref();

    function finish(action) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      action();
    }

    server.on('error', (err) => finish(() => reject(err)));
    server.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      if (onListening) onListening(`http://127.0.0.1:${actualPort}${path}`);
    });
  });
}
