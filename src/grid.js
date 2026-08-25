import { EventEmitter } from 'node:events';
import monomeGrid from 'monome-grid';

const clamp = (n) => Math.max(0, Math.min(15, Math.round(n)));

export function createGrid({
  id = null,
  cols = 16,
  rows = 8,
  connect = monomeGrid,
  fps = 60,
  backoffMs = 1000,
  maxBackoffMs = 30000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const emitter = new EventEmitter();
  const frame = Array.from({ length: rows }, () => new Array(cols).fill(0));
  let device = null;
  let dirty = true;
  let loop = null;
  let backoff = backoffMs;
  let stopped = false;
  let reconnectTimer = null;

  function setLevel(x, y, level) {
    if (y < 0 || y >= rows || x < 0 || x >= cols) return;
    const v = clamp(level);
    if (frame[y][x] !== v) {
      frame[y][x] = v;
      dirty = true;
    }
  }

  function getLevel(x, y) {
    if (y < 0 || y >= rows || x < 0 || x >= cols) return 0;
    return frame[y][x];
  }

  function clear() {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (frame[y][x] !== 0) dirty = true;
        frame[y][x] = 0;
      }
    }
  }

  function refreshNow() {
    if (!device || !dirty) return;
    try {
      device.refresh(frame);
      dirty = false;
    } catch (err) {
      console.error('grid refresh failed:', err.message);
      handleDisconnect();
    }
  }

  async function tryConnect() {
    try {
      device = await connect(id);
      device.key((x, y, s) => emitter.emit('press', x, y, s));
      dirty = true;
      backoff = backoffMs;
      emitter.emit('connected');
    } catch (err) {
      console.error('grid connect failed:', err.message);
      handleDisconnect();
    }
  }

  function handleDisconnect() {
    device = null;
    emitter.emit('disconnected');
    if (stopped) return;
    reconnectTimer = setTimer(async () => {
      reconnectTimer = null;
      if (!stopped) await tryConnect();
    }, backoff);
    backoff = Math.min(backoff * 2, maxBackoffMs);
  }

  async function start() {
    stopped = false;
    if (loop) clearInterval(loop);
    loop = setInterval(refreshNow, Math.round(1000 / fps));
    if (loop.unref) loop.unref();
    await tryConnect();
  }

  function stop() {
    stopped = true;
    if (loop) clearInterval(loop);
    loop = null;
    if (reconnectTimer) clearTimer(reconnectTimer);
    reconnectTimer = null;
    device = null;
  }

  return {
    cols,
    rows,
    on: (...a) => emitter.on(...a),
    setLevel,
    getLevel,
    clear,
    refreshNow,
    start,
    stop,
  };
}
