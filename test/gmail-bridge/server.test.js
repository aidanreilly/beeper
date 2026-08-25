import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from '../../src/gmail-bridge/server.js';

let server;

afterEach(() => {
  server?.close();
});

function listen(srv) {
  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => resolve(srv.address().port));
  });
}

describe('gmail-bridge server', () => {
  it('returns the count on GET /unread', async () => {
    server = createServer({ getCount: async () => 5 });
    const port = await listen(server);
    const res = await fetch(`http://127.0.0.1:${port}/unread`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 5 });
  });

  it('returns 502 when getCount rejects', async () => {
    server = createServer({ getCount: async () => { throw new Error('boom'); } });
    const port = await listen(server);
    const res = await fetch(`http://127.0.0.1:${port}/unread`);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'boom' });
  });

  it('returns 404 for an unknown route', async () => {
    server = createServer({ getCount: async () => 0 });
    const port = await listen(server);
    const res = await fetch(`http://127.0.0.1:${port}/other`);
    expect(res.status).toBe(404);
  });
});
