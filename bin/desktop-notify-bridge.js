#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { run } from '../src/desktop-notify/bridge.js';

// Usage:
//   desktop-notify-bridge [start] [--config <path>]   route notifications to beeper
//   desktop-notify-bridge --print [--config <path>]   log every notification's app/summary/body
const argv = process.argv.slice(2);
let configPath = path.join(os.homedir(), '.config', 'beeper', 'notify-rules.yaml');
let print = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--config') configPath = argv[++i];
  else if (argv[i] === '--print') print = true;
  // `start` is the default and needs no handling
}

run({ configPath, print })
  .then((code) => {
    if (typeof code === 'number' && code !== 0) process.exit(code);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
