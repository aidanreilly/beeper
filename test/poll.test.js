import { describe, it, expect, vi } from 'vitest';
import { createPollSource } from '../src/sources/poll.js';

function fakeTimers() {
  let cb = null;
  return {
    setTimer: (fn) => { cb = fn; return 1; },
    clearTimer: () => { cb = null; },
    tick: async () => { if (cb) await cb(); },
  };
}

function jsonResponse(obj) {
  return { ok: true, json: async () => obj };
}

const channel = {
  id: 'mail',
  trigger: { type: 'poll', url: 'http://x/unread', interval: 60, when: '$.count > 0' },
};

describe('poll source', () => {
  it('emits when the condition becomes true', async () => {
    const emit = vi.fn();
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ count: 2 }));
    const t = fakeTimers();
    const src = createPollSource(channel, emit, { fetch, setTimer: t.setTimer, clearTimer: t.clearTimer });
    src.start();
    await t.tick();
    expect(emit).toHaveBeenCalledWith('mail');
  });

  it('does not re-emit while the condition stays true (edge-triggered)', async () => {
    const emit = vi.fn();
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ count: 2 }));
    const t = fakeTimers();
    const src = createPollSource(channel, emit, { fetch, setTimer: t.setTimer, clearTimer: t.clearTimer });
    src.start();
    await t.tick();
    await t.tick();
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('re-emits after the condition goes false then true again', async () => {
    const emit = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ count: 2 }))
      .mockResolvedValueOnce(jsonResponse({ count: 0 }))
      .mockResolvedValueOnce(jsonResponse({ count: 5 }));
    const t = fakeTimers();
    const src = createPollSource(channel, emit, { fetch, setTimer: t.setTimer, clearTimer: t.clearTimer });
    src.start();
    await t.tick();
    await t.tick();
    await t.tick();
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('does not throw on fetch error', async () => {
    const emit = vi.fn();
    const fetch = vi.fn().mockRejectedValue(new Error('down'));
    const t = fakeTimers();
    const src = createPollSource(channel, emit, { fetch, setTimer: t.setTimer, clearTimer: t.clearTimer });
    src.start();
    await t.tick();
    expect(emit).not.toHaveBeenCalled();
  });
});
