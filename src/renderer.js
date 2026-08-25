export function levelFor(state, phaseSeconds, cfg) {
  if (state === 'idle') return cfg.idle;
  if (state === 'confirm') return cfg.confirm;
  // pending: triangle wave in [0,1] at blink_hz
  const t = (phaseSeconds * cfg.blink_hz) % 1;
  const tri = t < 0.5 ? t * 2 : 2 - t * 2; // 0..1..0
  const level = cfg.blink_low + tri * (cfg.blink_high - cfg.blink_low);
  return Math.round(level);
}

export function createRenderer({ grid, pager, cfg, now = () => Date.now(), fps = 60 }) {
  let timer = null;

  function tick(t = now()) {
    pager.update(t);
    const phase = t / 1000;
    for (const rc of pager.channels.values()) {
      grid.setLevel(rc.x, rc.y, levelFor(rc.state, phase, cfg));
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => tick(), Math.round(1000 / fps));
    if (timer.unref) timer.unref();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { tick, start, stop };
}
