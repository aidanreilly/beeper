import { describe, it, expect, vi } from 'vitest';
import { levelFor, createRenderer } from '../src/renderer.js';
import { FakeGrid } from './fakes/fake-grid.js';
import { createPager } from '../src/pager.js';

const cfg = { idle: 0, blink_low: 3, blink_high: 13, confirm: 15, blink_hz: 1 };

describe('levelFor', () => {
  it('returns idle level for idle state', () => {
    expect(levelFor('idle', 0, cfg)).toBe(0);
  });

  it('returns confirm level for confirm state', () => {
    expect(levelFor('confirm', 0.3, cfg)).toBe(15);
  });

  it('pulses pending between blink_low and blink_high', () => {
    const samples = [];
    for (let p = 0; p < 1; p += 0.05) samples.push(levelFor('pending', p, cfg));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(cfg.blink_low);
    expect(Math.max(...samples)).toBeLessThanOrEqual(cfg.blink_high);
    expect(Math.max(...samples)).toBeGreaterThan(Math.min(...samples));
  });

  it('still ramps pending smoothly when varibright is explicitly true', () => {
    const varibrightCfg = { ...cfg, varibright: true };
    const samples = [];
    for (let p = 0; p < 1; p += 0.05) samples.push(levelFor('pending', p, varibrightCfg));
    expect(Math.max(...samples)).toBeGreaterThan(Math.min(...samples));
  });

  it('flashes fully on in the first half of the cycle when varibright is false', () => {
    const monoCfg = { ...cfg, varibright: false };
    expect(levelFor('pending', 0, monoCfg)).toBe(cfg.blink_high);
    expect(levelFor('pending', 0.2, monoCfg)).toBe(cfg.blink_high);
  });

  it('flashes fully off in the second half of the cycle when varibright is false', () => {
    const monoCfg = { ...cfg, varibright: false };
    expect(levelFor('pending', 0.5, monoCfg)).toBe(0);
    expect(levelFor('pending', 0.8, monoCfg)).toBe(0);
  });

  it('produces only on/off levels over a full cycle when varibright is false', () => {
    const monoCfg = { ...cfg, varibright: false };
    const samples = new Set();
    for (let p = 0; p < 1; p += 0.02) samples.add(levelFor('pending', p, monoCfg));
    expect(samples).toEqual(new Set([0, cfg.blink_high]));
  });
});

describe('renderer.tick', () => {
  it('writes computed levels to the grid for each channel', () => {
    const grid = new FakeGrid();
    const pager = createPager({
      channels: [{ id: 'a', button: [2, 1], raise: { open: 'x' } }],
      raiser: { raise: vi.fn() },
      now: () => 0,
    });
    pager.notify('a');
    const renderer = createRenderer({ grid, pager, cfg, now: () => 0 });
    renderer.tick(0);
    expect(grid.getLevel(2, 1)).toBeGreaterThanOrEqual(cfg.blink_low);
  });

  it('writes cfg.idle to the grid for an idle channel', () => {
    const grid = new FakeGrid();
    const pager = createPager({
      channels: [{ id: 'a', button: [3, 2], raise: { open: 'x' } }],
      raiser: { raise: vi.fn() },
      now: () => 0,
    });
    const renderer = createRenderer({ grid, pager, cfg, now: () => 0 });
    renderer.tick(0);
    expect(grid.getLevel(3, 2)).toBe(cfg.idle);
  });

  it('writes cfg.confirm to the grid for a confirmed channel', () => {
    const grid = new FakeGrid();
    const pager = createPager({
      channels: [{ id: 'a', button: [4, 3], raise: { open: 'x' } }],
      raiser: { raise: vi.fn() },
      now: () => 0,
    });
    pager.notify('a');
    pager.handlePress(4, 3, 1);
    const renderer = createRenderer({ grid, pager, cfg, now: () => 0 });
    renderer.tick(0);
    expect(grid.getLevel(4, 3)).toBe(cfg.confirm);
  });
});
