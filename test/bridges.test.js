import { describe, it, expect, vi } from 'vitest';
import { createBridgeManager } from '../src/bridges.js';

const bridge = { id: 'gmail', command: ['gmail-bridge', 'start'], health: 'http://localhost:9000/unread' };

function immediateSleep() {
  return () => Promise.resolve();
}

describe('bridge manager', () => {
  it('skips spawning a bridge that already responds', async () => {
    const spawn = vi.fn();
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    const log = vi.fn();
    const mgr = createBridgeManager({ bridges: [bridge], deps: { spawn, fetch, log, sleep: immediateSleep() } });
    await mgr.start();
    expect(spawn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already running'));
  });

  it('spawns the command when the health probe is unreachable, then waits until it responds', async () => {
    const child = { kill: vi.fn() };
    const spawn = vi.fn().mockReturnValue(child);
    // first probe (pre-spawn) rejects; after spawn it comes up.
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ ok: true });
    const log = vi.fn();
    const mgr = createBridgeManager({ bridges: [bridge], deps: { spawn, fetch, log, sleep: immediateSleep() } });
    await mgr.start();
    expect(spawn).toHaveBeenCalledWith('gmail-bridge', ['start'], expect.any(Object));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('started'));
  });

  it('does not throw when a spawned bridge never becomes ready; logs an error', async () => {
    const child = { kill: vi.fn() };
    const spawn = vi.fn().mockReturnValue(child);
    const fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const logError = vi.fn();
    const mgr = createBridgeManager({
      bridges: [bridge],
      deps: { spawn, fetch, logError, sleep: immediateSleep(), readyAttempts: 3 },
    });
    await expect(mgr.start()).resolves.toBeUndefined();
    expect(spawn).toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('gmail'));
  });

  it('stop() kills only the children it spawned', async () => {
    const child = { kill: vi.fn() };
    const spawn = vi.fn().mockReturnValue(child);
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ ok: true });
    const mgr = createBridgeManager({ bridges: [bridge], deps: { spawn, fetch, log: vi.fn(), sleep: immediateSleep() } });
    await mgr.start();
    mgr.stop();
    expect(child.kill).toHaveBeenCalled();
  });

  it('stop() does not kill an externally-running bridge it never spawned', async () => {
    const spawn = vi.fn();
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    const mgr = createBridgeManager({ bridges: [bridge], deps: { spawn, fetch, log: vi.fn(), sleep: immediateSleep() } });
    await mgr.start();
    mgr.stop();
    expect(spawn).not.toHaveBeenCalled();
  });
});
