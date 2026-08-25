import { describe, it, expect } from 'vitest';
import { evaluateWhen } from '../src/sources/when.js';

describe('evaluateWhen', () => {
  it('compares numbers', () => {
    expect(evaluateWhen('$.count > 0', { count: 3 })).toBe(true);
    expect(evaluateWhen('$.count > 0', { count: 0 })).toBe(false);
  });

  it('supports equality and strings', () => {
    expect(evaluateWhen('$.status == "open"', { status: 'open' })).toBe(true);
    expect(evaluateWhen('$.status != "open"', { status: 'closed' })).toBe(true);
  });

  it('indexes into arrays and nested objects', () => {
    expect(evaluateWhen('$.items[0].unread >= 2', { items: [{ unread: 5 }] })).toBe(true);
  });

  it('treats a bare path as a truthiness test', () => {
    expect(evaluateWhen('$.hasAlert', { hasAlert: true })).toBe(true);
    expect(evaluateWhen('$.hasAlert', { hasAlert: false })).toBe(false);
    expect(evaluateWhen('$.missing', {})).toBe(false);
  });

  it('supports boolean and null literals', () => {
    expect(evaluateWhen('$.done == true', { done: true })).toBe(true);
    expect(evaluateWhen('$.value != null', { value: 0 })).toBe(true);
  });
});
