import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWebhookSource } from '../src/sources/webhook.js';

let src;
afterEach(() => src?.stop());

async function post(port, path, { token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers });
  return res.status;
}

const channels = [{ id: 'prs', trigger: { type: 'webhook' } }];

describe('webhook source', () => {
  it('emits and returns 204 for a known channel', async () => {
    const emit = vi.fn();
    src = createWebhookSource({ channels, webhook: { host: '127.0.0.1', port: 0 }, emit });
    const port = await src.start();
    expect(await post(port, '/notify/prs')).toBe(204);
    expect(emit).toHaveBeenCalledWith('prs');
  });

  it('returns 404 for an unknown channel', async () => {
    const emit = vi.fn();
    src = createWebhookSource({ channels, webhook: { host: '127.0.0.1', port: 0 }, emit });
    const port = await src.start();
    expect(await post(port, '/notify/nope')).toBe(404);
    expect(emit).not.toHaveBeenCalled();
  });

  it('enforces bearer token when configured', async () => {
    const emit = vi.fn();
    src = createWebhookSource({ channels, webhook: { host: '127.0.0.1', port: 0, token: 'sekret' }, emit });
    const port = await src.start();
    expect(await post(port, '/notify/prs')).toBe(401);
    expect(await post(port, '/notify/prs', { token: 'sekret' })).toBe(204);
  });

  it('survives a malformed percent-encoded path without crashing', async () => {
    const emit = vi.fn();
    src = createWebhookSource({ channels, webhook: { host: '127.0.0.1', port: 0 }, emit });
    const port = await src.start();
    expect(await post(port, '/notify/%E0%A4%A')).toBe(400);
    // the process, and the server, must still be alive and serving afterward
    expect(await post(port, '/notify/prs')).toBe(204);
    expect(emit).toHaveBeenCalledWith('prs');
  });
});
