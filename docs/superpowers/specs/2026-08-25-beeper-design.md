# beeper design

A configurable Node.js pager for the monome grid. Beeper connects to a
monome grid over USB, receives notifications from local and web
applications, lights and slowly blinks a grid button per notification,
and raises the originating page or app when the button is pressed.

- Status: approved design, ready for implementation planning
- Date: 2026-08-25
- Primary OS: Linux (Wayland). Also runs on macOS and Windows.

## Purpose

Give physical, glanceable, ambient notification presence on a monome
grid. A button pulsing in the corner of the desk means something wants
attention. One press takes you to it. No screen, no popup, no tab
hunting.

## Scope

### In scope for v1

- Connect to a monome grid via serialosc using the `monome-grid`
  package, with automatic reconnection.
- Static button mapping: each notification channel is pinned to a fixed
  button in config.
- Slow blink (varibright pulse) on a pending button.
- Three notification sources: REST webhook (push), HTTP polling, and
  RSS/Atom feeds.
- Two raise actions: open a URL, or run a shell command.
- YAML config with schema validation and environment-variable secrets.
- CLI: `start`, `test`, `doctor`.
- Cross-platform URL opening (Linux/macOS/Windows).

### Out of scope for v1 (documented future work)

- Focusing native GUI application windows. Ruled out because reliable
  window control on Wayland is compositor-specific and fragile. The
  `run` raise action is the escape hatch (a user can script a focus
  command if their environment supports it).
- Persisting pending notifications across a beeper restart (in-memory
  only for v1).
- Dynamic or hybrid button allocation (v1 is static pinning only).
- Arc support, multi-grid support, grid text/scrolling.
- A configuration GUI.

## Domain model

The central object is a **channel**. One channel owns exactly one grid
button. A channel bundles three concerns:

1. **trigger** — how a notification for this channel arrives (webhook,
   poll, or rss).
2. **appearance** — which button `[x, y]` and how it renders when
   pending.
3. **raise action** — what happens when the lit button is pressed
   (`open` a URL or `run` a command).

Sources produce notifications tagged with a channel id. The core marks
the channel pending, the renderer blinks its button, and a press fires
the raise action and clears the channel.

### Channel state machine

```
        notification for channel
  IDLE ───────────────────────────▶ PENDING
   ▲                                   │
   │                                   │ button pressed (key down on this button)
   │                                   ▼
   │                              raise action fires
   │                                   │
   └──────────── CONFIRM ◀─────────────┘
        (brief flash, then back to IDLE)
```

- IDLE: button at `brightness.idle` (default 0, dark).
- PENDING: button pulses between `blink_low` and `blink_high` at
  `blink_hz`.
- CONFIRM: on a successful press, a brief bright flash acknowledges the
  action, then the channel returns to IDLE.
- A new notification arriving for a channel already PENDING is
  idempotent: it stays PENDING (optionally refreshes a "last seen"
  timestamp for logging). It does not queue multiples in v1.
- Notifications arriving while the grid is disconnected still move the
  channel to PENDING in memory; the button lights up on reconnect.

## Architecture

Beeper is composed of small units with single responsibilities that
communicate through defined interfaces. Each is testable in isolation
against fakes.

```
 sources/            core (pager)         renderer          grid controller
 ┌─────────┐  notify ┌───────────┐ state  ┌────────┐ levels ┌────────────┐
 │ webhook │────────▶│  channel  │───────▶│ blink  │───────▶│ monome-grid│──▶ serialosc ──▶ USB grid
 │ poll    │────────▶│  state    │        │ engine │        │  framebuf  │
 │ rss     │────────▶│  machine  │◀───────│        │◀───────│  press evt │◀── key presses
 └─────────┘         └─────┬─────┘  press └────────┘        └────────────┘
                           │ raise
                           ▼
                       ┌────────┐
                       │ raiser │  open URL / run command
                       └────────┘
```

### Components

**Grid controller** (`src/grid.js`)
- Wraps `monome-grid`. Responsibilities: connect (optionally to a named
  device), maintain a 2D LED framebuffer `[y][x]` of levels 0–15, run a
  dirty-refresh loop (~60 fps, only calls `grid.refresh` when the
  framebuffer changed), and emit `press(x, y, s)` from `grid.key`.
- Handles reconnection: on connect failure or key-stream loss, retry
  with exponential backoff (capped, e.g. 30s). Emits `connected` /
  `disconnected` events.
- Reads grid dimensions from the connected device (default 16×8).
  Exposes `width`/`height` for config validation.
- Knows nothing about channels or notifications.
- Interface consumed by the app: `setLevel(x, y, level)`,
  `getFrame()`, `on('press', …)`, `on('connected'|'disconnected', …)`,
  `clear()`, `stop()`.

**Renderer / blink engine** (`src/renderer.js`)
- Owns per-button visual state derived from channel states plus a
  monotonic phase clock. Each tick it computes the level for every
  active button and writes it via the grid controller's `setLevel`.
- Slow blink: a triangle or sine pulse between `blink_low` and
  `blink_high` at `blink_hz` (default 0.7 Hz). CONFIRM is a short
  full-brightness flash on a timer.
- Pure function at its heart: `levelFor(state, phase, cfg)` is unit
  tested with no hardware.

**Core / pager** (`src/pager.js`)
- The domain brain. Holds the channel registry (id → channel config +
  runtime state) and the button→channel index.
- `onNotification(channelId)` marks a channel PENDING.
- `onPress(x, y, s)` looks up the channel at that button; if PENDING
  and `s === 1`, invokes the raiser, moves to CONFIRM, schedules return
  to IDLE.
- Emits state changes the renderer consumes. No I/O of its own; the
  raiser and clock are injected.

**Sources** (`src/sources/*.js`)
- Common interface: `start()`, `stop()`, and an event emitter that
  fires `notification(channelId, payload)`.
- A **registry** (`src/sources/index.js`) maps a trigger `type` string
  to a source factory, so new source types are added by registering a
  factory. This is the plugin seam.
- `webhook.js`: one shared `node:http` server. Routes `POST
  /notify/:id` to the channel with that id. Optional bearer-token auth
  from config. Binds to `127.0.0.1` by default. Returns 204 on accept,
  404 for unknown channel id, 401 on bad token.
- `poll.js`: per-channel timer. Each interval, `fetch` the URL, parse
  JSON, evaluate the `when` expression against it; fire on transition
  to true (edge-triggered, not level-triggered, to avoid re-firing
  every interval while the condition stays true).
- `rss.js`: per-channel timer using `rss-parser`. Track the newest seen
  item id/guid per feed; fire when a newer item appears. Seed the
  "seen" marker on first fetch so startup does not fire for the whole
  backlog.

**Raiser** (`src/raiser.js`)
- `raise(action)`: if `action.open`, open the URL with the `open`
  package (xdg-open / open / start under the hood). If `action.run`,
  spawn the command via `child_process` (detached, stdio ignored).
- The only OS-specific surface, and it is thin. Unit tested by
  injecting fake `open`/`spawn`.

**Config** (`src/config.js`)
- Load a YAML file, resolve `${ENV_VAR}` references (for tokens),
  validate against a `zod` schema, and return a typed config object.
- Validation includes: unique channel ids, button coordinates within
  grid bounds where known, each channel has a valid trigger and exactly
  one raise action, no two channels share a button.
- Default config path: `~/.config/beeper/config.yaml` on Linux, with
  `--config <path>` override. Document macOS/Windows locations.

**Entry + CLI** (`src/index.js`, `bin/beeper.js`)
- `beeper start` (default): load config, construct grid, renderer,
  pager, raiser, and sources; wire events; run until SIGINT/SIGTERM,
  then clear the grid and shut down cleanly.
- `beeper test`: connect and walk the LEDs (brightness sweep / button
  chase) to confirm hardware and orientation.
- `beeper doctor`: check that serialosc is reachable and a grid is
  discovered; print device id and size; validate the config file.

## Configuration example

```yaml
grid:
  device: null            # null = auto-discover; or a serialosc id like "m1000011"
  brightness:
    idle: 0
    blink_low: 3
    blink_high: 14
    confirm: 15
  blink_hz: 0.7

webhook:
  host: 127.0.0.1
  port: 8420
  token: ${BEEPER_TOKEN}  # optional; omit to disable auth

channels:
  - id: prs
    button: [0, 0]
    trigger: { type: webhook }
    raise:   { open: "https://github.com/pulls" }

  - id: mail
    button: [1, 0]
    trigger:
      type: poll
      url: "http://localhost:9000/unread"
      interval: 60          # seconds
      when: "$.count > 0"   # JSONPath-style expression, edge-triggered
    raise: { run: "thunderbird" }

  - id: news
    button: [2, 0]
    trigger:
      type: rss
      url: "https://example.com/feed.xml"
      interval: 300
    raise: { open: "https://example.com" }
```

## Key decisions

- **Config format: YAML** (approved). Human-friendly, comments allowed.
- **Poll condition: a small JSONPath-style `when` expression**
  (approved), evaluated with a minimal safe evaluator over the fetched
  JSON. Edge-triggered so it fires on the transition to true, not every
  interval. If richer logic is needed later, a `run`-style poll script
  can be added as another trigger type through the source registry.
- **Webhook uses built-in `node:http`**, no web framework, to keep the
  dependency footprint minimal.
- **Blink is a render-loop pulse**, not a hardware blink command, so
  brightness curve and rate are fully controllable and consistent
  across grid models.
- **No native window focus in v1.** Raising is URL-open or command-run,
  which is portable across Linux/macOS/Windows and sidesteps Wayland
  window-control limitations.

## Error handling and resilience

- Grid disconnect: reconnect with backoff; keep channel states in
  memory; relight pending buttons on reconnect.
- Source failures (network error, bad feed, non-200 poll): log and
  continue; never crash the process. A failing source retries on its
  next interval.
- Webhook: reject unknown channel ids and bad tokens with clear status
  codes; a malformed body does not crash the server.
- Config errors: fail fast at startup with a readable validation
  message (which channel, which field).
- Raise action failure (command not found, opener error): log it and
  still clear the channel, so a broken action does not leave a button
  stuck blinking. (Alternative considered: keep blinking on failure.
  Rejected for v1 because a stuck button is worse UX than a logged
  miss.)
- Clean shutdown on SIGINT/SIGTERM clears the grid so no LEDs are left
  lit.

## Stack and dependencies

- Node.js LTS (20+), ES modules.
- `monome-grid` — grid connection over serialosc/OSC.
- `zod` — config schema validation.
- `yaml` — config parsing.
- `rss-parser` — RSS/Atom parsing.
- `open` — cross-platform URL opening.
- Built-in `node:http` (webhook) and global `fetch` (polling).
- `vitest` — test runner.
- Runtime prerequisite (not an npm dep): **serialosc** must be
  installed and running on the host. Documented in the README with per
  OS install notes. `beeper doctor` verifies it.

## Testing strategy

TDD throughout, driven by a **fake grid** that implements the grid
controller's interface in memory: it records `setLevel` calls, exposes
the framebuffer, and lets tests inject `press` events. No hardware
needed for the suite.

Unit-tested units:
- Pager channel state machine (idle → pending → confirm → idle;
  idempotent re-notify; press only fires when pending).
- Renderer `levelFor` brightness math across states and phases.
- Config loader (valid configs parse; each invalid case yields a clear
  error; env-var resolution; duplicate button/id detection).
- Poll source (edge-triggering; `when` evaluation; error tolerance)
  with a fake fetch.
- RSS source (new-item detection; startup backlog suppression) with a
  fake parser.
- Webhook source (routing, auth, status codes) via `http` requests to
  an ephemeral port.
- Raiser (open vs run dispatch) with injected fakes.

Manual/hardware verification via `beeper test` and `beeper doctor`
against a real grid.

## Repository layout

```
beeper/
  bin/beeper.js            # CLI entry
  src/
    index.js               # app wiring / lifecycle
    grid.js                # grid controller (monome-grid wrapper)
    renderer.js            # blink engine
    pager.js               # channel state machine (core)
    raiser.js              # open URL / run command
    config.js              # load + validate YAML
    sources/
      index.js             # source registry
      webhook.js
      poll.js
      rss.js
  test/
    fakes/fake-grid.js
    *.test.js
  docs/
    superpowers/specs/2026-08-25-beeper-design.md
  config.example.yaml
  README.md
  package.json
```

## Open questions for future iterations

- Persist pending state across restarts (small JSON state file)?
- Multiple pending notifications per channel with a count display?
- Grid brightness/idle "screensaver" behavior when nothing is pending?
- Hot config reload on file change or SIGHUP.
