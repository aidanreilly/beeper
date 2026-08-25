import { describe, it, expect, vi } from 'vitest';
import { parseArgs, run } from '../src/cli.js';

describe('parseArgs', () => {
  it('defaults to the start command', () => {
    expect(parseArgs([]).command).toBe('start');
  });

  it('reads a command and --config path', () => {
    const a = parseArgs(['doctor', '--config', '/tmp/c.yaml']);
    expect(a.command).toBe('doctor');
    expect(a.configPath).toBe('/tmp/c.yaml');
  });
});

describe('doctor', () => {
  it('reports a discovered grid', async () => {
    const log = vi.fn();
    const config = { grid: { device: null, cols: 16, rows: 8 } };
    const deps = {
      loadConfig: () => config,
      createGrid: () => ({ start: vi.fn().mockResolvedValue(), stop: vi.fn(), cols: 16, rows: 8, on: vi.fn() }),
      log,
    };
    const code = await run(['doctor', '--config', '/x'], { deps });
    expect(code).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/grid/i));
  });

  it('returns non-zero when config is invalid', async () => {
    const deps = {
      loadConfig: () => { throw new Error('Invalid config: boom'); },
      log: vi.fn(),
      logError: vi.fn(),
    };
    const code = await run(['doctor', '--config', '/x'], { deps });
    expect(code).toBe(1);
  });
});
