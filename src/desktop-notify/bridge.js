import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { createNotifyParser } from './parse.js';
import { compileRules, matchEvent } from './match.js';
import { loadRules } from './config.js';

// Watch the desktop notification bus and POST beeper's webhook when a
// notification matches a rule. With `print: true` it instead logs every
// notification's app name, summary, and body, so you can discover exactly
// what an app calls itself on the bus and write a rule for it.
export async function run({ configPath, print = false, deps = {} } = {}) {
  const spawnFn = deps.spawn ?? spawn;
  const fetch = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;

  const cfg = loadRules(configPath);
  const compiled = compileRules(cfg.rules);
  const debounceMs = cfg.debounce * 1000;
  const lastFire = new Map();

  const child = spawnFn(
    'dbus-monitor',
    ["interface='org.freedesktop.Notifications',member='Notify'"],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );

  const onEvent = (e) => {
    if (print) {
      log(`app="${e.app}" summary="${e.summary}" body="${e.body}"`);
      return;
    }
    const channel = matchEvent(e, compiled);
    if (!channel) return;
    const t = now();
    if (t - (lastFire.get(channel) ?? 0) < debounceMs) return; // collapse the bus's duplicate Notify
    lastFire.set(channel, t);
    const headers = cfg.webhook.token ? { Authorization: `Bearer ${cfg.webhook.token}` } : {};
    fetch(`${cfg.webhook.url}/notify/${encodeURIComponent(channel)}`, { method: 'POST', headers }).catch(
      (err) => logError(`post ${channel} failed: ${err.message}`),
    );
  };

  const parser = createNotifyParser(onEvent);
  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => parser.push(line));

  if (print) log(`# watching notifications; matched rules -> ${cfg.webhook.url}/notify/<channel>`);

  return new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 0)));
}
