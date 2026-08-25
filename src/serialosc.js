import { spawn as nodeSpawn } from 'node:child_process';
import dgram from 'node:dgram';

const SERIALOSC_PORT = 12002;

// serialoscd binds this UDP port; a bind that fails with EADDRINUSE means
// it (or something) is already there.
export function isPortInUse(port, deps = {}) {
  const createSocket = deps.createSocket ?? (() => dgram.createSocket('udp4'));
  return new Promise((resolve) => {
    const sock = createSocket();
    sock.once('error', (err) => {
      try { sock.close(); } catch { /* already closing */ }
      resolve(err.code === 'EADDRINUSE');
    });
    sock.bind(port, () => {
      sock.close();
      resolve(false);
    });
  });
}

export function createSerialoscDaemon({ config, deps = {} }) {
  const spawn = deps.spawn ?? nodeSpawn;
  const portInUse = deps.portInUse ?? isPortInUse;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;
  const readyAttempts = deps.readyAttempts ?? 40;
  const readyIntervalMs = deps.readyIntervalMs ?? 250;
  const port = deps.port ?? SERIALOSC_PORT;

  const sc = config.grid.serialosc;
  let child = null;

  async function ensure() {
    if (!sc?.autostart) return;
    if (await portInUse(port)) {
      log('serialoscd already running');
      return;
    }
    const [cmd, ...args] = sc.command;
    child = spawn(cmd, args, { stdio: 'inherit' });

    let ready = false;
    for (let i = 0; i < readyAttempts && !ready; i++) {
      if (i > 0) await sleep(readyIntervalMs);
      ready = await portInUse(port);
    }
    if (ready) log('serialoscd started');
    else logError('serialoscd did not become ready');
  }

  function stop() {
    if (child) {
      child.kill?.();
      child = null;
    }
  }

  return { ensure, stop };
}
