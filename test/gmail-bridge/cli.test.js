import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { parseArgs, run } from '../../src/gmail-bridge/cli.js';

describe('parseArgs', () => {
  it('defaults to the start command with default paths, port, and query', () => {
    const a = parseArgs([]);
    expect(a.command).toBe('start');
    expect(a.clientPath).toBe(path.join(os.homedir(), '.config', 'beeper', 'gmail-client.json'));
    expect(a.tokenPath).toBe(path.join(os.homedir(), '.config', 'beeper', 'gmail-token.json'));
    expect(a.port).toBe(9000);
    expect(a.query).toBe('label:UNREAD in:inbox');
  });

  it('reads the auth command and overrides', () => {
    const a = parseArgs(['auth', '--client', '/tmp/c.json', '--token', '/tmp/t.json']);
    expect(a.command).toBe('auth');
    expect(a.clientPath).toBe('/tmp/c.json');
    expect(a.tokenPath).toBe('/tmp/t.json');
  });

  it('reads --port and --query for start', () => {
    const a = parseArgs(['start', '--port', '9100', '--query', 'label:UNREAD']);
    expect(a.port).toBe(9100);
    expect(a.query).toBe('label:UNREAD');
  });
});

describe('run: auth', () => {
  function authDeps(overrides = {}) {
    return {
      readClientFile: vi.fn().mockReturnValue({ clientId: 'cid', clientSecret: 'shh' }),
      writeTokenFile: vi.fn(),
      buildAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/consent'),
      exchangeCode: vi.fn().mockResolvedValue({ refreshToken: 'rt-1' }),
      waitForAuthCode: vi.fn().mockImplementation(async ({ onListening }) => {
        onListening('http://127.0.0.1:8421/oauth2callback');
        return 'code-1';
      }),
      open: vi.fn(),
      log: vi.fn(),
      logError: vi.fn(),
      fetch: vi.fn(),
      ...overrides,
    };
  }

  it('runs the full consent flow and saves the refresh token', async () => {
    const deps = authDeps();
    const code = await run(['auth', '--client', '/tmp/c.json', '--token', '/tmp/t.json'], { deps });
    expect(code).toBe(0);
    expect(deps.open).toHaveBeenCalledWith('https://accounts.google.com/consent');
    expect(deps.exchangeCode).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'cid', clientSecret: 'shh', code: 'code-1' }),
    );
    expect(deps.writeTokenFile).toHaveBeenCalledWith('/tmp/t.json', { refreshToken: 'rt-1' });
    expect(deps.log).toHaveBeenCalled();
  });

  it('returns 1 and logs when the client file is missing', async () => {
    const deps = authDeps({
      readClientFile: vi.fn().mockImplementation(() => {
        throw new Error('Gmail OAuth client file not found: /tmp/c.json');
      }),
    });
    const code = await run(['auth'], { deps });
    expect(code).toBe(1);
    expect(deps.logError).toHaveBeenCalledWith(expect.stringMatching(/client file not found/));
  });

  it('returns 1 and logs when the consent flow fails', async () => {
    const deps = authDeps({
      waitForAuthCode: vi.fn().mockRejectedValue(new Error('Timed out after 120000ms')),
    });
    const code = await run(['auth'], { deps });
    expect(code).toBe(1);
    expect(deps.logError).toHaveBeenCalledWith(expect.stringMatching(/Timed out/));
  });
});

describe('run: start', () => {
  function startDeps(overrides = {}) {
    const listeners = {};
    const fakeServer = {
      listen: vi.fn((port, cb) => cb()),
      close: vi.fn(),
    };
    return {
      readClientFile: vi.fn().mockReturnValue({ clientId: 'cid', clientSecret: 'shh' }),
      readTokenFile: vi.fn().mockReturnValue({ refreshToken: 'rt-1' }),
      refreshAccessToken: vi.fn().mockResolvedValue({ accessToken: 'at-1', expiresAt: Date.now() + 3600_000 }),
      fetchUnreadCount: vi.fn().mockResolvedValue(2),
      createServer: vi.fn().mockImplementation(({ getCount }) => {
        listeners.getCount = getCount;
        return fakeServer;
      }),
      log: vi.fn(),
      logError: vi.fn(),
      fetch: vi.fn(),
      _fakeServer: fakeServer,
      _listeners: listeners,
      ...overrides,
    };
  }

  it('starts the server and logs the listening port', async () => {
    const deps = startDeps();
    const code = await run(['start', '--port', '9100'], { deps });
    expect(code).toBe(0);
    expect(deps._fakeServer.listen).toHaveBeenCalledWith(9100, expect.any(Function));
    expect(deps.log).toHaveBeenCalledWith(expect.stringMatching(/9100/));
  });

  it('wires getCount to refresh then fetch the unread count', async () => {
    const deps = startDeps();
    await run(['start', '--query', 'label:UNREAD in:inbox'], { deps });
    const count = await deps._listeners.getCount();
    expect(count).toBe(2);
    expect(deps.refreshAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'cid', clientSecret: 'shh', refreshToken: 'rt-1' }),
    );
    expect(deps.fetchUnreadCount).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'at-1', query: 'label:UNREAD in:inbox' }),
    );
  });

  it('reuses a cached access token until it is near expiry', async () => {
    const deps = startDeps();
    await run(['start'], { deps });
    await deps._listeners.getCount();
    await deps._listeners.getCount();
    expect(deps.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(deps.fetchUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('returns 1 and logs when the token file is missing', async () => {
    const deps = startDeps({
      readTokenFile: vi.fn().mockImplementation(() => {
        throw new Error('Gmail token file not found: /tmp/t.json');
      }),
    });
    const code = await run(['start'], { deps });
    expect(code).toBe(1);
    expect(deps.logError).toHaveBeenCalledWith(expect.stringMatching(/token file not found/));
  });
});
