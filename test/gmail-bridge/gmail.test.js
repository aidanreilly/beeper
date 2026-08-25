import { describe, it, expect, vi } from 'vitest';
import { fetchUnreadCount } from '../../src/gmail-bridge/gmail.js';

function jsonResponse(ok, status, obj) {
  return { ok, status, json: async () => obj };
}

describe('fetchUnreadCount', () => {
  it('returns resultSizeEstimate as the count', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(true, 200, { resultSizeEstimate: 3 }));
    const count = await fetchUnreadCount({ accessToken: 'at-1', query: 'label:UNREAD in:inbox', fetch });
    expect(count).toBe(3);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    expect(url).toContain(encodeURIComponent('label:UNREAD in:inbox'));
    expect(opts.headers.Authorization).toBe('Bearer at-1');
  });

  it('returns 0 when resultSizeEstimate is absent', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(true, 200, {}));
    const count = await fetchUnreadCount({ accessToken: 'at-1', query: 'x', fetch });
    expect(count).toBe(0);
  });

  it('throws on a non-ok response', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse(false, 401, { error: { message: 'Invalid Credentials' } }),
    );
    await expect(fetchUnreadCount({ accessToken: 'bad', query: 'x', fetch })).rejects.toThrow(
      /Invalid Credentials/,
    );
  });
});
