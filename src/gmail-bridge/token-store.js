import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function readClientFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `Gmail OAuth client file not found: ${path}\n` +
          'Create one in Google Cloud Console (OAuth client, type "Desktop app"), ' +
          'download it, and save it at this path (or pass --client <path>).',
      );
    }
    throw err;
  }
  const data = JSON.parse(raw);
  const installed = data.installed;
  if (!installed?.client_id || !installed?.client_secret) {
    throw new Error(
      `Gmail OAuth client file at ${path} is missing "installed.client_id"/"installed.client_secret"`,
    );
  }
  return { clientId: installed.client_id, clientSecret: installed.client_secret };
}

export function readTokenFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Gmail token file not found: ${path}\nRun "gmail-bridge auth" first.`);
    }
    throw err;
  }
  const data = JSON.parse(raw);
  if (!data.refresh_token) {
    throw new Error(`Gmail token file at ${path} is missing "refresh_token"`);
  }
  return { refreshToken: data.refresh_token };
}

export function writeTokenFile(path, { refreshToken }) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ refresh_token: refreshToken }, null, 2));
}
