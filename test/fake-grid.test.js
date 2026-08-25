import { describe, it, expect, vi } from 'vitest';
import { FakeGrid } from './fakes/fake-grid.js';

describe('FakeGrid', () => {
  it('stores and clamps levels', () => {
    const g = new FakeGrid();
    g.setLevel(3, 2, 9);
    expect(g.getLevel(3, 2)).toBe(9);
    g.setLevel(3, 2, 99);
    expect(g.getLevel(3, 2)).toBe(15);
    g.setLevel(3, 2, -5);
    expect(g.getLevel(3, 2)).toBe(0);
  });

  it('clears the framebuffer', () => {
    const g = new FakeGrid();
    g.setLevel(0, 0, 12);
    g.clear();
    expect(g.getLevel(0, 0)).toBe(0);
  });

  it('emits press events', () => {
    const g = new FakeGrid();
    const seen = vi.fn();
    g.on('press', seen);
    g.emitPress(5, 1, 1);
    expect(seen).toHaveBeenCalledWith(5, 1, 1);
  });
});
