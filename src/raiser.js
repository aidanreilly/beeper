import openPkg from 'open';
import { spawn as nodeSpawn } from 'node:child_process';

export function createRaiser({ open = openPkg, spawn = nodeSpawn } = {}) {
  function raise(action) {
    try {
      if (action.open) {
        Promise.resolve(open(action.open)).catch((err) =>
          console.error(`open failed for "${action.open}":`, err.message),
        );
      } else if (action.run) {
        const child = spawn(action.run, { shell: true, detached: true, stdio: 'ignore' });
        child.unref();
      }
    } catch (err) {
      console.error('raise failed:', err.message);
    }
  }
  return { raise };
}
