import os from 'node:os';
import path from 'node:path';
import { loadConfig as defaultLoadConfig } from './config.js';
import { createApp } from './app.js';
import { createGrid as defaultCreateGrid } from './grid.js';

export function defaultConfigPath() {
  return path.join(os.homedir(), '.config', 'beeper', 'config.yaml');
}

export function parseArgs(argv) {
  let command = 'start';
  let configPath = defaultConfigPath();
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith('-')) command = rest.shift();
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--config') configPath = rest[++i];
  }
  return { command, configPath };
}

export async function run(argv, { deps = {} } = {}) {
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const createGrid = deps.createGrid ?? defaultCreateGrid;
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;
  const { command, configPath } = parseArgs(argv);

  let config;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    logError(err.message);
    return 1;
  }

  if (command === 'doctor') {
    try {
      const grid = createGrid({ id: config.grid.device, cols: config.grid.cols, rows: config.grid.rows });
      await grid.start();
      log(`grid connected (${grid.cols}x${grid.rows})`);
      grid.stop();
      return 0;
    } catch (err) {
      logError(`grid check failed: ${err.message}`);
      return 1;
    }
  }

  if (command === 'test') {
    const grid = createGrid({ id: config.grid.device, cols: config.grid.cols, rows: config.grid.rows });
    grid.on('press', (x, y, s) => log(`press ${x},${y} ${s}`));
    await grid.start();
    let level = 0;
    const iv = setInterval(() => {
      level = (level + 1) % 16;
      for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) grid.setLevel(x, y, level);
      grid.refreshNow();
    }, 200);
    process.on('SIGINT', () => { clearInterval(iv); grid.clear(); grid.refreshNow(); grid.stop(); process.exit(0); });
    return 0;
  }

  // start
  const app = createApp({ config });
  await app.start();
  log(`beeper started (${config.channels.length} channels)`);
  const shutdown = () => { app.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return 0;
}
