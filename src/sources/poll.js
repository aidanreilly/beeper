import { evaluateWhen } from './when.js';

export function createPollSource(
  channel,
  emit,
  { fetch = globalThis.fetch, setTimer = setInterval, clearTimer = clearInterval } = {},
) {
  const { url, interval, when } = channel.trigger;
  let last = false;
  let handle = null;

  async function poll() {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const now = evaluateWhen(when, data);
      if (now && !last) emit(channel.id);
      last = now;
    } catch (err) {
      console.error(`poll "${channel.id}" failed:`, err.message);
    }
  }

  function start() {
    handle = setTimer(poll, interval * 1000);
  }

  function stop() {
    if (handle) clearTimer(handle);
    handle = null;
  }

  return { start, stop };
}
