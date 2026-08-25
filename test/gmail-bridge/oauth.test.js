import { describe, it, expect, vi } from 'vitest';
import { buildAuthUrl, exchangeCode, refreshAccessToken } from '../../src/gmail-bridge/oauth.js';

function jsonResponse(ok, obj) {
  return { ok, json: async () => obj };
}

describe('buildAuthUrl', () => {
  it('builds a Google consent URL with the gmail.readonly scope', () => {
    const url = buildAuthUrl({ clientId: 'abc', redirectUri: 'http://127.0.0.1:8421/oauth2callback' });
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
    expect(url).toContain('client_id=abc');
    expect(url).toContain(encodeURIComponent('http://127.0.0.1:8421/oauth2callback'));
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly'));
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });
});

describe('exchangeCode', () => {
  it('posts the auth code and returns tokens', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse(true, { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600 }),
    );
    const before = Date.now();
    const result = await exchangeCode({
      clientId: 'abc',
      clientSecret: 'shh',
      code: 'code-1',
      redirectUri: 'http://127.0.0.1:8421/oauth2callback',
      fetch,
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.refreshToken).toBe('rt-1');
    expect(result.accessToken).toBe('at-1');
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
  });

  it('throws with Google\'s error message on failure', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(false, { error: 'invalid_grant' }));
    await expect(
      exchangeCode({ clientId: 'a', clientSecret: 'b', code: 'c', redirectUri: 'd', fetch }),
    ).rejects.toThrow(/invalid_grant/);
  });

  it('throws with error_description when error field is absent', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(false, { error_description: 'The auth code has expired' }));
    await expect(
      exchangeCode({ clientId: 'a', clientSecret: 'b', code: 'c', redirectUri: 'd', fetch }),
    ).rejects.toThrow(/The auth code has expired/);
  });
});

describe('refreshAccessToken', () => {
  it('posts the refresh token and returns a new access token', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(true, { access_token: 'at-2', expires_in: 3600 }));
    const result = await refreshAccessToken({
      clientId: 'abc',
      clientSecret: 'shh',
      refreshToken: 'rt-1',
      fetch,
    });
    expect(result.accessToken).toBe('at-2');
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });
});
