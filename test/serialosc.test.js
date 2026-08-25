import { describe, it, expect, vi } from 'vitest';
import dgram from 'node:dgram';
import { createSerialoscDaemon, isPortInUse } from '../src/serialosc.js';

const gridWith = (serialosc) => ({ grid: { serialosc } });
const immediateSleep = () => () => Promise.resolve();

describe('isPortInUse', () => {
  it('reports true for a bound UDP port and false for a free one', async () => {
    const sock = dgram.createSocket('udp4');
    const port = await new Promise((resolve) => sock.bind(0, () => resolve(sock.address().port)));
    try {
      expect(await isPortInUse(port)).toBe(true);
    } finally {
      sock.close();
    }
    // Same port is free once closed.
    await new Promise((r) => setTimeout(r, 50));
    expect(await isPortInUse(port)).toBe(false);
  });
});

describe('serialosc daemon', () => {
  const command = ['serialoscd'];

  it('does nothing when autostart is off', async () => {
    const spawn = vi.fn();
    const daemon = createSerialoscDaemon({
      config: gridWith({ autostart: false, command }),
      deps: { spawn, portInUse: vi.fn(), sleep: immediateSleep() },
    });
    await daemon.ensure();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('does nothing when serialosc config is absent', async () => {
    const spawn = vi.fn();
    const daemon = createSerialoscDaemon({ config: gridWith(undefined), deps: { spawn, sleep: immediateSleep() } });
    await daemon.ensure();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('skips spawning when the port is already in use', async () => {
    const spawn = vi.fn();
    const portInUse = vi.fn().mockResolvedValue(true);
    const log = vi.fn();
    const daemon = createSerialoscDaemon({
      config: gridWith({ autostart: true, command }),
      deps: { spawn, portInUse, log, sleep: immediateSleep() },
    });
    await daemon.ensure();
    expect(spawn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already running'));
  });

  it('spawns serialoscd when the port is free, then waits until it binds', async () => {
    const child = { kill: vi.fn() };
    const spawn = vi.fn().mockReturnValue(child);
    // free before spawn, bound after.
    const portInUse = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const log = vi.fn();
    const daemon = createSerialoscDaemon({
      config: gridWith({ autostart: true, command }),
      deps: { spawn, portInUse, log, sleep: immediateSleep() },
    });
    await daemon.ensure();
    expect(spawn).toHaveBeenCalledWith('serialoscd', [], expect.any(Object));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('started'));
  });

  it('does not throw when serialoscd never binds the port; logs an error', async () => {
    const child = { kill: vi.fn() };
    const spawn = vi.fn().mockReturnValue(child);
    const portInUse = vi.fn().mockResolvedValue(false);
    const logError = vi.fn();
    const daemon = createSerialoscDaemon({
      config: gridWith({ autostart: true, command }),
      deps: { spawn, portInUse, logError, sleep: immediateSleep(), readyAttempts: 3 },
    });
    await expect(daemon.ensure()).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('serialoscd'));
  });

  it('stop() kills a spawned daemon but not one already running', async () => {
    const child = { kill: vi.fn() };
    const spawn = vi.fn().mockReturnValue(child);
    const spawned = createSerialoscDaemon({
      config: gridWith({ autostart: true, command }),
      deps: { spawn, portInUse: vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true), log: vi.fn(), sleep: immediateSleep() },
    });
    await spawned.ensure();
    spawned.stop();
    expect(child.kill).toHaveBeenCalled();

    const external = createSerialoscDaemon({
      config: gridWith({ autostart: true, command }),
      deps: { spawn: vi.fn(), portInUse: vi.fn().mockResolvedValue(true), log: vi.fn(), sleep: immediateSleep() },
    });
    await external.ensure();
    expect(() => external.stop()).not.toThrow();
  });
});
