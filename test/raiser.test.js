import { describe, it, expect, vi } from 'vitest';
import { createRaiser } from '../src/raiser.js';

describe('raiser', () => {
  it('opens a URL', () => {
    const open = vi.fn().mockResolvedValue();
    const spawn = vi.fn();
    createRaiser({ open, spawn }).raise({ open: 'http://x' });
    expect(open).toHaveBeenCalledWith('http://x');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('runs a command detached', () => {
    const open = vi.fn();
    const child = { unref: vi.fn() };
    const spawn = vi.fn().mockReturnValue(child);
    createRaiser({ open, spawn }).raise({ run: 'echo hi' });
    expect(spawn).toHaveBeenCalledWith('echo hi', expect.objectContaining({ shell: true, detached: true }));
    expect(child.unref).toHaveBeenCalled();
  });

  it('does not throw when open rejects', async () => {
    const open = vi.fn().mockRejectedValue(new Error('no opener'));
    const spawn = vi.fn();
    expect(() => createRaiser({ open, spawn }).raise({ open: 'http://x' })).not.toThrow();
    await Promise.resolve();
  });

  it('does not throw when spawn throws synchronously', () => {
    const open = vi.fn();
    const spawn = vi.fn().mockImplementation(() => {
      throw new Error('spawn boom');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => createRaiser({ open, spawn }).raise({ run: 'echo hi' })).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
