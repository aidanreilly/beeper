import { describe, it, expect } from 'vitest';
import { parseConfig } from '../src/config.js';

const base = `
channels:
  - id: prs
    button: [0, 0]
    trigger: { type: webhook }
    raise: { open: "https://example.com/pulls" }
`;

describe('parseConfig', () => {
  it('parses a minimal config and applies defaults', () => {
    const cfg = parseConfig(base);
    expect(cfg.grid.blink_hz).toBe(0.7);
    expect(cfg.grid.brightness.blink_high).toBe(14);
    expect(cfg.grid.rows).toBe(8);
    expect(cfg.grid.cols).toBe(16);
    expect(cfg.webhook.host).toBe('127.0.0.1');
    expect(cfg.webhook.port).toBe(8420);
    expect(cfg.channels[0].id).toBe('prs');
    expect(cfg.channels[0].button).toEqual([0, 0]);
  });

  it('resolves ${ENV} references in strings', () => {
    process.env.BEEPER_TEST_TOKEN = 'secret123';
    const cfg = parseConfig(`
webhook: { token: "\${BEEPER_TEST_TOKEN}" }
${base}
`);
    expect(cfg.webhook.token).toBe('secret123');
  });

  it('rejects duplicate channel ids', () => {
    expect(() => parseConfig(`
channels:
  - { id: a, button: [0,0], trigger: { type: webhook }, raise: { open: "x" } }
  - { id: a, button: [1,0], trigger: { type: webhook }, raise: { open: "y" } }
`)).toThrow(/duplicate channel id/i);
  });

  it('rejects two channels on the same button', () => {
    expect(() => parseConfig(`
channels:
  - { id: a, button: [0,0], trigger: { type: webhook }, raise: { open: "x" } }
  - { id: b, button: [0,0], trigger: { type: webhook }, raise: { open: "y" } }
`)).toThrow(/button .*already/i);
  });

  it('rejects a raise action that is neither open nor run', () => {
    expect(() => parseConfig(`
channels:
  - { id: a, button: [0,0], trigger: { type: webhook }, raise: {} }
`)).toThrow();
  });

  it('rejects a poll trigger missing a when expression', () => {
    expect(() => parseConfig(`
channels:
  - { id: a, button: [0,0], trigger: { type: poll, url: "http://x", interval: 60 }, raise: { open: "x" } }
`)).toThrow();
  });

  it('rejects a button whose row is outside the default grid', () => {
    expect(() => parseConfig(`
channels:
  - { id: a, button: [0,10], trigger: { type: webhook }, raise: { open: "x" } }
`)).toThrow(/outside the grid|out of/i);
  });

  it('rejects a button whose column is outside the default grid', () => {
    expect(() => parseConfig(`
channels:
  - { id: a, button: [16,0], trigger: { type: webhook }, raise: { open: "x" } }
`)).toThrow(/outside the grid|out of/i);
  });

  it('accepts an in-bounds button on a custom grid size', () => {
    const cfg = parseConfig(`
grid: { cols: 8, rows: 8 }
channels:
  - { id: a, button: [7,7], trigger: { type: webhook }, raise: { open: "x" } }
`);
    expect(cfg.channels[0].button).toEqual([7, 7]);
  });

  it('defaults grid.varibright to true', () => {
    const cfg = parseConfig(base);
    expect(cfg.grid.varibright).toBe(true);
  });

  it('accepts grid.varibright set to false', () => {
    const cfg = parseConfig(`
grid: { varibright: false }
${base}
`);
    expect(cfg.grid.varibright).toBe(false);
  });
});
