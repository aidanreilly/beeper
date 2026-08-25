import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { FakeGrid } from './fakes/fake-grid.js';

const config = {
  grid: { device: null, cols: 16, rows: 8, blink_hz: 1, brightness: { idle: 0, blink_low: 3, blink_high: 13, confirm: 15 } },
  webhook: { host: '127.0.0.1', port: 0 },
  channels: [{ id: 'a', button: [0, 0], trigger: { type: 'webhook' }, raise: { open: 'http://a' } }],
};

describe('app wiring', () => {
  it('routes a grid press over a pending channel to the raiser', async () => {
    const grid = new FakeGrid();
    grid.start = vi.fn(); grid.stop = vi.fn();
    const raise = vi.fn();
    const app = createApp({
      config,
      deps: {
        createGrid: () => grid,
        raiser: { raise },
        sources: [],   // no live sources in this test
      },
    });
    await app.start();
    // simulate a notification arriving, then a press
    app.notify('a');
    grid.emitPress(0, 0, 1);
    expect(raise).toHaveBeenCalledWith({ open: 'http://a' });
    app.stop();
  });

  it('start()/stop() drive the grid and sources lifecycle, and stop() clears the grid', async () => {
    const grid = new FakeGrid();
    grid.start = vi.fn().mockResolvedValue();
    grid.stop = vi.fn();
    const startSpy = grid.start;
    const stopSpy = grid.stop;
    const source = { start: vi.fn().mockResolvedValue(), stop: vi.fn() };
    const app = createApp({
      config,
      deps: {
        createGrid: () => grid,
        raiser: { raise: vi.fn() },
        sources: [source],
      },
    });

    await app.start();
    expect(startSpy).toHaveBeenCalled();
    expect(source.start).toHaveBeenCalled();

    // simulate a lit LED, as if a pending channel were blinking
    grid.setLevel(0, 0, 12);
    expect(grid.getLevel(0, 0)).toBe(12);

    app.stop();
    expect(source.stop).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
    expect(grid.getLevel(0, 0)).toBe(0);
  });
});
