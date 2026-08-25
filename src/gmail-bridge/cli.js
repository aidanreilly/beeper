import os from 'node:os';
import path from 'node:path';
import open from 'open';
import { readClientFile as defaultReadClientFile, readTokenFile as defaultReadTokenFile, writeTokenFile as defaultWriteTokenFile } from './token-store.js';
import { buildAuthUrl as defaultBuildAuthUrl, exchangeCode as defaultExchangeCode, refreshAccessToken as defaultRefreshAccessToken } from './oauth.js';
import { fetchUnreadCount as defaultFetchUnreadCount } from './gmail.js';
import { createServer as defaultCreateServer } from './server.js';
import { waitForAuthCode as defaultWaitForAuthCode } from './callback-listener.js';

export function defaultClientPath() {
  return path.join(os.homedir(), '.config', 'beeper', 'gmail-client.json');
}

export function defaultTokenPath() {
  return path.join(os.homedir(), '.config', 'beeper', 'gmail-token.json');
}

export function parseArgs(argv) {
  let command = 'start';
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith('-')) command = rest.shift();
  const opts = {
    command,
    clientPath: defaultClientPath(),
    tokenPath: defaultTokenPath(),
    port: 9000,
    query: 'label:UNREAD in:inbox',
  };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--client') opts.clientPath = rest[++i];
    else if (rest[i] === '--token') opts.tokenPath = rest[++i];
    else if (rest[i] === '--port') opts.port = Number(rest[++i]);
    else if (rest[i] === '--query') opts.query = rest[++i];
  }
  return opts;
}

export async function run(argv, { deps = {} } = {}) {
  const readClientFile = deps.readClientFile ?? defaultReadClientFile;
  const readTokenFile = deps.readTokenFile ?? defaultReadTokenFile;
  const writeTokenFile = deps.writeTokenFile ?? defaultWriteTokenFile;
  const buildAuthUrl = deps.buildAuthUrl ?? defaultBuildAuthUrl;
  const exchangeCode = deps.exchangeCode ?? defaultExchangeCode;
  const refreshAccessToken = deps.refreshAccessToken ?? defaultRefreshAccessToken;
  const fetchUnreadCount = deps.fetchUnreadCount ?? defaultFetchUnreadCount;
  const createServer = deps.createServer ?? defaultCreateServer;
  const waitForAuthCode = deps.waitForAuthCode ?? defaultWaitForAuthCode;
  const openFn = deps.open ?? open;
  const fetch = deps.fetch ?? globalThis.fetch;
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;
  const authTimeoutMs = deps.authTimeoutMs ?? 120000;
  const callbackPort = deps.callbackPort ?? 8421;

  const { command, clientPath, tokenPath, port, query } = parseArgs(argv);

  if (command === 'auth') {
    try {
      const client = readClientFile(clientPath);
      let redirectUri;
      const code = await waitForAuthCode({
        port: callbackPort,
        timeoutMs: authTimeoutMs,
        onListening: (uri) => {
          redirectUri = uri;
          openFn(buildAuthUrl({ clientId: client.clientId, redirectUri }));
        },
      });
      const tokens = await exchangeCode({
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        code,
        redirectUri,
        fetch,
      });
      writeTokenFile(tokenPath, { refreshToken: tokens.refreshToken });
      log(`Saved refresh token to ${tokenPath}`);
      return 0;
    } catch (err) {
      logError(err.message);
      return 1;
    }
  }

  // start (Task 7)
  return 0;
}
