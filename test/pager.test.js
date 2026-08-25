import { describe, it, expect, vi } from 'vitest';
import { createPager } from '../src/pager.js';

function setup() {
  const raise = vi.fn();
  const channels = [
    { id: 'a', button: [0, 0], raise: { open: 'http://a' } },
    { id: 'b', button: [1, 0], raise: { run: 'echo b' } },
  ];
  const pager = createPager({ channels, raiser: { raise }, now: () => 1000, confirmMs: 250 });
  return { pager, raise };
}

describe('pager', () => {
  it('marks a channel pending on notify', () => {
    const { pager } = setup();
    expect(pager.notify('a')).toBe(true);
    expect(pager.channels.get('a').state).toBe('pending');
  });

  it('ignores unknown channel ids', () => {
    const { pager } = setup();
    expect(pager.notify('nope')).toBe(false);
  });

  it('fires the raise action on key-down over a pending button', () => {
    const { pager, raise } = setup();
    pager.notify('a');
    const fired = pager.handlePress(0, 0, 1);
    expect(fired).toBe(true);
    expect(raise).toHaveBeenCalledWith({ open: 'http://a' });
    expect(pager.channels.get('a').state).toBe('confirm');
  });

  it('does not fire on key-up', () => {
    const { pager, raise } = setup();
    pager.notify('a');
    expect(pager.handlePress(0, 0, 0)).toBe(false);
    expect(raise).not.toHaveBeenCalled();
  });

  it('does not fire when the channel is idle', () => {
    const { pager, raise } = setup();
    expect(pager.handlePress(0, 0, 1)).toBe(false);
    expect(raise).not.toHaveBeenCalled();
  });

  it('re-notify while pending is idempotent', () => {
    const { pager } = setup();
    pager.notify('a');
    pager.notify('a');
    expect(pager.channels.get('a').state).toBe('pending');
  });

  it('expires confirm back to idle after confirmMs', () => {
    const raise = vi.fn();
    let t = 1000;
    const pager = createPager({
      channels: [{ id: 'a', button: [0, 0], raise: { open: 'http://a' } }],
      raiser: { raise },
      now: () => t,
      confirmMs: 250,
    });
    pager.notify('a');
    pager.handlePress(0, 0, 1);
    t = 1200;
    pager.update(t);
    expect(pager.channels.get('a').state).toBe('confirm');
    t = 1300;
    pager.update(t);
    expect(pager.channels.get('a').state).toBe('idle');
  });
});
