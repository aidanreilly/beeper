import { describe, it, expect } from 'vitest';
import { waitForAuthCode } from '../../src/gmail-bridge/callback-listener.js';

describe('waitForAuthCode', () => {
  it('resolves with the code from the redirect', async () => {
    const codePromise = waitForAuthCode({
      port: 0,
      timeoutMs: 2000,
      onListening: (redirectUri) => {
        fetch(`${redirectUri}?code=abc123`);
      },
    });
    await expect(codePromise).resolves.toBe('abc123');
  });

  it('rejects when Google reports a consent error', async () => {
    const codePromise = waitForAuthCode({
      port: 0,
      timeoutMs: 2000,
      onListening: (redirectUri) => {
        fetch(`${redirectUri}?error=access_denied`);
      },
    });
    await expect(codePromise).rejects.toThrow(/access_denied/);
  });

  it('rejects after the timeout with no request', async () => {
    const codePromise = waitForAuthCode({ port: 0, timeoutMs: 50 });
    await expect(codePromise).rejects.toThrow(/Timed out/);
  });
});
