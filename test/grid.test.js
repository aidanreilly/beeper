import { describe, it, expect, vi } from 'vitest';
import { createGrid } from '../src/grid.js';

function fakeDevice() {
  let keyCb = null;
  return {
    refresh: vi.fn(),
    key: (cb) => { keyCb = cb; },
    press: (x, y, s) => keyCb && keyCb(x, y, s),
  };
}

describe('grid controller', () => {
  it('connects and forwards key presses as press events', async () => {
    const dev = fakeDevice();
    const connect = vi.fn().mockResolvedValue(dev);
    const grid = createGrid({ cols: 16, rows: 8, connect });
    const onPress = vi.fn();
    grid.on('press', onPress);
    await grid.start();
    dev.press(3, 2, 1);
    expect(onPress).toHaveBeenCalledWith(3, 2, 1);
    grid.stop();
  });

  it('refreshes the device only when the framebuffer is dirty', async () => {
    const dev = fakeDevice();
    const connect = vi.fn().mockResolvedValue(dev);
    const grid = createGrid({ cols: 16, rows: 8, connect });
    await grid.start();
    grid.setLevel(0, 0, 10);
    grid.refreshNow();
    grid.refreshNow();
    expect(dev.refresh).toHaveBeenCalledTimes(1);
    grid.setLevel(0, 0, 5);
    grid.refreshNow();
    expect(dev.refresh).toHaveBeenCalledTimes(2);
    grid.stop();
  });

  it('retries with backoff when connect rejects', async () => {
    const dev = fakeDevice();
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('no serialosc'))
      .mockResolvedValueOnce(dev);
    let scheduled = null;
    const setTimer = (fn) => { scheduled = fn; return 1; };
    const grid = createGrid({ cols: 16, rows: 8, connect, setTimer, clearTimer: () => {} });
    const onDisc = vi.fn();
    grid.on('disconnected', onDisc);
    await grid.start();
    expect(onDisc).toHaveBeenCalled();
    expect(connect).toHaveBeenCalledTimes(1);
    await scheduled(); // fire the backoff retry
    expect(connect).toHaveBeenCalledTimes(2);
    grid.stop();
  });

  it('getLevel returns 0 for out-of-bounds coordinates instead of throwing', async () => {
    const dev = fakeDevice();
    const connect = vi.fn().mockResolvedValue(dev);
    const grid = createGrid({ cols: 16, rows: 8, connect });
    await grid.start();
    expect(() => grid.getLevel(-1, 0)).not.toThrow();
    expect(grid.getLevel(-1, 0)).toBe(0);
    expect(grid.getLevel(0, -1)).toBe(0);
    expect(grid.getLevel(16, 0)).toBe(0);
    expect(grid.getLevel(0, 8)).toBe(0);
    grid.stop();
  });

  it('clears the pending reconnect timer via clearTimer on stop', async () => {
    const connect = vi.fn().mockRejectedValueOnce(new Error('no serialosc'));
    let scheduledHandle = null;
    const setTimer = () => { scheduledHandle = { id: 'reconnect' }; return scheduledHandle; };
    const clearTimer = vi.fn();
    const grid = createGrid({ cols: 16, rows: 8, connect, setTimer, clearTimer });
    await grid.start();
    expect(scheduledHandle).not.toBeNull();
    grid.stop();
    expect(clearTimer).toHaveBeenCalledWith(scheduledHandle);
  });
});
