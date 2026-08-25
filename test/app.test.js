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

  it('starts bridges before sources and stops them on shutdown', async () => {
    const grid = new FakeGrid();
    grid.start = vi.fn().mockResolvedValue();
    grid.stop = vi.fn();
    const order = [];
    const bridges = {
      start: vi.fn(async () => { order.push('bridges.start'); }),
      stop: vi.fn(() => { order.push('bridges.stop'); }),
    };
    const source = {
      start: vi.fn(async () => { order.push('source.start'); }),
      stop: vi.fn(() => { order.push('source.stop'); }),
    };
    const app = createApp({
      config,
      deps: {
        createGrid: () => grid,
        raiser: { raise: vi.fn() },
        bridges,
        sources: [source],
      },
    });

    await app.start();
    expect(bridges.start).toHaveBeenCalled();
    expect(order.indexOf('bridges.start')).toBeLessThan(order.indexOf('source.start'));

    app.stop();
    expect(bridges.stop).toHaveBeenCalled();
  });

  it('ensures serialoscd before starting the grid and stops it on shutdown', async () => {
    const order = [];
    const grid = new FakeGrid();
    grid.start = vi.fn(async () => { order.push('grid.start'); });
    grid.stop = vi.fn();
    const serialosc = {
      ensure: vi.fn(async () => { order.push('serialosc.ensure'); }),
      stop: vi.fn(() => { order.push('serialosc.stop'); }),
    };
    const app = createApp({
      config,
      deps: {
        createGrid: () => grid,
        raiser: { raise: vi.fn() },
        serialosc,
        sources: [],
      },
    });

    await app.start();
    expect(serialosc.ensure).toHaveBeenCalled();
    expect(order.indexOf('serialosc.ensure')).toBeLessThan(order.indexOf('grid.start'));

    app.stop();
    expect(serialosc.stop).toHaveBeenCalled();
  });

  it('starts sources even when the grid never connects', async () => {
    const grid = new FakeGrid();
    // Mirrors the real monome-grid: connect() never resolves/rejects
    // when no grid is present.
    grid.start = vi.fn(() => new Promise(() => {}));
    grid.stop = vi.fn();
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

    expect(source.start).toHaveBeenCalled();
  });
});
