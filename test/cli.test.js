import { describe, it, expect, vi } from 'vitest';
import { parseArgs, run } from '../src/cli.js';
import { FakeGrid } from './fakes/fake-grid.js';

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
    const grid = new FakeGrid({ cols: 16, rows: 8 });
    grid.start = vi.fn(() => grid.emit('connected'));
    grid.stop = vi.fn();
    const exit = vi.fn();
    const deps = {
      loadConfig: () => config,
      createGrid: () => grid,
      log,
      doctorTimeoutMs: 50,
      exit,
    };
    const code = await run(['doctor', '--config', '/x'], { deps });
    expect(code).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/grid/i));
    expect(grid.stop).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('returns non-zero when no grid is found', async () => {
    const config = { grid: { device: null, cols: 16, rows: 8 } };
    const grid = new FakeGrid({ cols: 16, rows: 8 });
    grid.start = vi.fn(() => grid.emit('disconnected'));
    grid.stop = vi.fn();
    const exit = vi.fn();
    const deps = {
      loadConfig: () => config,
      createGrid: () => grid,
      log: vi.fn(),
      logError: vi.fn(),
      doctorTimeoutMs: 50,
      exit,
    };
    const code = await run(['doctor', '--config', '/x'], { deps });
    expect(code).toBe(1);
    expect(deps.logError).toHaveBeenCalled();
    expect(grid.stop).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('returns non-zero when the grid check times out', async () => {
    const config = { grid: { device: null, cols: 16, rows: 8 } };
    const grid = new FakeGrid({ cols: 16, rows: 8 });
    grid.start = vi.fn();
    grid.stop = vi.fn();
    const exit = vi.fn();
    const deps = {
      loadConfig: () => config,
      createGrid: () => grid,
      log: vi.fn(),
      logError: vi.fn(),
      doctorTimeoutMs: 20,
      exit,
    };
    const code = await run(['doctor', '--config', '/x'], { deps });
    expect(code).toBe(1);
    expect(deps.logError).toHaveBeenCalled();
    expect(grid.stop).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
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
