import { describe, it, expect, vi } from 'vitest';
import { createRssSource } from '../src/sources/rss.js';

function fakeTimers() {
  let cb = null;
  return {
    setTimer: (fn) => { cb = fn; return 1; },
    clearTimer: () => { cb = null; },
    tick: async () => { if (cb) await cb(); },
  };
}

const channel = { id: 'news', trigger: { type: 'rss', url: 'http://x/feed', interval: 300 } };

describe('rss source', () => {
  it('does not emit on the first fetch (seeds the marker)', async () => {
    const emit = vi.fn();
    const parser = { parseURL: vi.fn().mockResolvedValue({ items: [{ guid: '1' }] }) };
    const t = fakeTimers();
    const src = createRssSource(channel, emit, { parser, setTimer: t.setTimer, clearTimer: t.clearTimer });
    src.start();
    await t.tick();
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits when a newer item appears', async () => {
    const emit = vi.fn();
    const parser = {
      parseURL: vi
        .fn()
        .mockResolvedValueOnce({ items: [{ guid: '1' }] })
        .mockResolvedValueOnce({ items: [{ guid: '2' }, { guid: '1' }] }),
    };
    const t = fakeTimers();
    const src = createRssSource(channel, emit, { parser, setTimer: t.setTimer, clearTimer: t.clearTimer });
    src.start();
    await t.tick();
    await t.tick();
    expect(emit).toHaveBeenCalledWith('news');
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the parser fails', async () => {
    const emit = vi.fn();
    const parser = { parseURL: vi.fn().mockRejectedValue(new Error('bad feed')) };
    const t = fakeTimers();
    const src = createRssSource(channel, emit, { parser, setTimer: t.setTimer, clearTimer: t.clearTimer });
    src.start();
    await t.tick();
    expect(emit).not.toHaveBeenCalled();
  });
});
