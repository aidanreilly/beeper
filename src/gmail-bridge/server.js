import { createServer as createHttpServer } from 'node:http';

export function createServer({ getCount }) {
  return createHttpServer(async (req, res) => {
    const pathname = req.url.split('?')[0];
    if (req.method === 'GET' && pathname === '/unread') {
      try {
        const count = await getCount();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ count }));
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
}
