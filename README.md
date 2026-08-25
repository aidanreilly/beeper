# beeper

A configurable pager for the [monome grid](https://monome.org/). beeper
lights and slowly blinks a grid button when a notification arrives from a
webhook, an HTTP poll, or an RSS feed. Press the lit button and beeper
raises the source: it opens a URL or runs a command.

## Requirements

- Node.js 20 or newer.
- **serialosc** running on the host (beeper talks to your grid through it).
  - Linux: build from https://github.com/monome/serialosc (needs libmonome, liblo, libuv), or use your distro package.
  - macOS / Windows: install from https://github.com/monome/serialosc/releases
- A monome grid connected over USB.

## Install

```bash
npm install
npm link        # optional: puts `beeper` on your PATH
```

## Configure

```bash
mkdir -p ~/.config/beeper
cp config.example.yaml ~/.config/beeper/config.yaml
$EDITOR ~/.config/beeper/config.yaml
```

Each `channel` pins one grid button to a trigger and a raise action.
Set `grid.cols`/`grid.rows` to match your device (128 = 16x8, 64 = 8x8).

## Run

```bash
beeper doctor     # check serialosc + grid and validate config
beeper test       # light the grid and print presses (Ctrl-C to stop)
beeper start      # run the pager (Ctrl-C to stop)
```

`doctor` validates the config file first, then waits (2 seconds) for the
grid to report itself connected. On a machine with no serialosc running or
no grid attached, it reports the grid was not found and exits non-zero;
that's the expected result until a grid answers.

## Firing notifications

- **Webhook:** `curl -X POST http://127.0.0.1:8420/notify/<channel-id>`
  (add `-H "Authorization: Bearer $BEEPER_TOKEN"` if a token is set).
- **Poll:** beeper GETs `url` every `interval` seconds and fires when the
  `when` expression transitions to true. `when` supports `$.path`
  comparisons, e.g. `$.count > 0`, `$.status == "open"`, `$.items[0].n >= 2`.
- **RSS:** beeper checks the feed every `interval` seconds and fires when a
  new item appears.

## How it works

serialosc discovers the grid over USB and exposes it via OSC. beeper uses
the `monome-grid` package to talk to serialosc, runs a render loop that
pulses pending buttons, and performs the raise action on press.

## Platform notes

Raising is `open` (URL) or `run` (command), which work on Linux, macOS, and
Windows. Focusing a native application window is not built in; on Linux
Wayland that is compositor-specific. Use a `run` action with your own focus
command if your environment supports it.

## Development

```bash
npm test          # run the vitest suite
npm run test:watch
```
