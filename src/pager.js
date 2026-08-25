export const CONFIRM_MS = 250;

export function createPager({ channels, raiser, now = () => Date.now(), confirmMs = CONFIRM_MS }) {
  const map = new Map();
  const byButton = new Map();
  for (const ch of channels) {
    const rc = {
      id: ch.id,
      x: ch.button[0],
      y: ch.button[1],
      state: 'idle',
      confirmUntil: 0,
      raise: ch.raise,
    };
    map.set(ch.id, rc);
    byButton.set(`${rc.x},${rc.y}`, rc);
  }

  function notify(channelId) {
    const rc = map.get(channelId);
    if (!rc) return false;
    if (rc.state !== 'confirm') rc.state = 'pending';
    return true;
  }

  function channelAt(x, y) {
    return byButton.get(`${x},${y}`);
  }

  function handlePress(x, y, s) {
    if (s !== 1) return false;
    const rc = channelAt(x, y);
    if (!rc || rc.state !== 'pending') return false;
    try {
      raiser.raise(rc.raise);
    } catch (err) {
      console.error(`raise failed for channel "${rc.id}":`, err.message);
    }
    rc.state = 'confirm';
    rc.confirmUntil = now() + confirmMs;
    return true;
  }

  function update(t = now()) {
    for (const rc of map.values()) {
      if (rc.state === 'confirm' && t >= rc.confirmUntil) rc.state = 'idle';
    }
  }

  return { notify, handlePress, update, channelAt, channels: map };
}
