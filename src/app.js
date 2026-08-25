import { createGrid as defaultCreateGrid } from './grid.js';
import { createRenderer } from './renderer.js';
import { createPager } from './pager.js';
import { createRaiser } from './raiser.js';
import { createSources as defaultCreateSources } from './sources/index.js';

export function createApp({ config, deps = {} }) {
  const createGrid = deps.createGrid ?? defaultCreateGrid;
  const raiser = deps.raiser ?? createRaiser();
  const pager = createPager({ channels: config.channels, raiser });

  const grid = createGrid({
    id: config.grid.device,
    cols: config.grid.cols,
    rows: config.grid.rows,
  });
  grid.on('press', (x, y, s) => pager.handlePress(x, y, s));

  const renderer = createRenderer({
    grid,
    pager,
    cfg: { ...config.grid.brightness, blink_hz: config.grid.blink_hz },
  });

  const emit = (id) => pager.notify(id);
  const sources =
    deps.sources ?? defaultCreateSources({ config, emit, deps: deps.sourceDeps });

  async function start() {
    Promise.resolve(grid.start()).catch((err) => console.error('grid start failed:', err.message));
    renderer.start();
    for (const s of sources) await s.start();
  }

  function stop() {
    for (const s of sources) s.stop();
    renderer.stop();
    grid.clear();
    grid.refreshNow?.();
    grid.stop();
  }

  return { start, stop, notify: emit };
}
