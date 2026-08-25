import { spawn as nodeSpawn } from 'node:child_process';

export function createBridgeManager({ bridges = [], deps = {} }) {
  const spawn = deps.spawn ?? nodeSpawn;
  const fetch = deps.fetch ?? globalThis.fetch;
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const readyAttempts = deps.readyAttempts ?? 40;
  const readyIntervalMs = deps.readyIntervalMs ?? 250;

  const children = [];

  async function reachable(url) {
    try {
      await fetch(url);
      return true;
    } catch {
      return false;
    }
  }

  async function start() {
    for (const b of bridges) {
      if (await reachable(b.health)) {
        log(`bridge "${b.id}" already running`);
        continue;
      }
      const [cmd, ...args] = b.command;
      const child = spawn(cmd, args, { stdio: 'inherit' });
      children.push(child);

      let ready = false;
      for (let i = 0; i < readyAttempts && !ready; i++) {
        if (i > 0) await sleep(readyIntervalMs);
        ready = await reachable(b.health);
      }
      if (ready) log(`bridge "${b.id}" started`);
      else logError(`bridge "${b.id}" did not become ready`);
    }
  }

  function stop() {
    for (const child of children) child.kill?.();
    children.length = 0;
  }

  return { start, stop };
}
