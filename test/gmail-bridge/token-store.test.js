import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readClientFile, readTokenFile, writeTokenFile } from '../../src/gmail-bridge/token-store.js';

let dir;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'gmail-bridge-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('readClientFile', () => {
  it('reads client id/secret from a Google-downloaded client file', () => {
    const p = path.join(dir, 'client.json');
    writeFileSync(p, JSON.stringify({ installed: { client_id: 'abc', client_secret: 'shh' } }));
    expect(readClientFile(p)).toEqual({ clientId: 'abc', clientSecret: 'shh' });
  });

  it('throws an actionable error when the file is missing', () => {
    expect(() => readClientFile(path.join(dir, 'nope.json'))).toThrow(/Cloud Console/);
  });

  it('throws when required fields are missing', () => {
    const p = path.join(dir, 'client.json');
    writeFileSync(p, JSON.stringify({ installed: { client_id: 'abc' } }));
    expect(() => readClientFile(p)).toThrow(/client_secret/);
  });
});

describe('readTokenFile', () => {
  it('reads the refresh token', () => {
    const p = path.join(dir, 'token.json');
    writeFileSync(p, JSON.stringify({ refresh_token: 'rt-1' }));
    expect(readTokenFile(p)).toEqual({ refreshToken: 'rt-1' });
  });

  it('throws an actionable error when the file is missing', () => {
    expect(() => readTokenFile(path.join(dir, 'nope.json'))).toThrow(/gmail-bridge auth/);
  });
});

describe('writeTokenFile', () => {
  it('writes the refresh token, creating parent directories', () => {
    const p = path.join(dir, 'nested', 'token.json');
    writeTokenFile(p, { refreshToken: 'rt-2' });
    expect(JSON.parse(readFileSync(p, 'utf8'))).toEqual({ refresh_token: 'rt-2' });
  });
});
