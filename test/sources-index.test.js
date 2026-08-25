import { describe, it, expect, vi } from 'vitest';
import { createSources } from '../src/sources/index.js';

const config = {
  webhook: { host: '127.0.0.1', port: 0 },
  channels: [
    { id: 'w', button: [0, 0], trigger: { type: 'webhook' }, raise: { open: 'x' } },
    { id: 'p', button: [1, 0], trigger: { type: 'poll', url: 'http://x', interval: 60, when: '$.n > 0' }, raise: { open: 'x' } },
    { id: 'r', button: [2, 0], trigger: { type: 'rss', url: 'http://x/feed', interval: 300 }, raise: { open: 'x' } },
  ],
};

describe('createSources', () => {
  it('builds one source per poll/rss channel plus one shared webhook source', () => {
    const deps = {
      fetch: vi.fn(),
      parser: { parseURL: vi.fn() },
      setTimer: vi.fn(),
      clearTimer: vi.fn(),
    };
    const sources = createSources({ config, emit: vi.fn(), deps });
    // 1 webhook + 1 poll + 1 rss
    expect(sources).toHaveLength(3);
    for (const s of sources) {
      expect(typeof s.start).toBe('function');
      expect(typeof s.stop).toBe('function');
    }
  });
});
