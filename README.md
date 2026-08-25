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

The `raise` action is what beeper does when you press the lit button. It
takes exactly one of:

- `open: <url-or-path>` — hand it to the desktop's default handler, the
  same as `xdg-open` (or `open` on macOS). Good for URLs.
- `run: <command>` — run any shell command, detached. Use this when you
  need a specific command, e.g. opening a Gmail account in the browser:

  ```yaml
  raise: { run: "xdg-open https://mail.google.com/mail/u/1/#inbox" }
  ```

  Quote the whole value: an unquoted `#` starts a YAML comment, which
  would drop the URL fragment.

`grid.varibright` (default `true`) controls how a pending button blinks. On
varibright grids it pulses smoothly between `blink_low` and `blink_high`. On
older monobright grids (64/40h), every brightness above 0 looks identical, so
the pulse looks steady-lit; set `grid.varibright: false` to make pending
buttons flash fully on and off instead, at the same `blink_hz` rate.

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

### serialoscd

The grid talks to beeper through `serialoscd`, monome's OSC daemon. If it
isn't running, no grid is ever discovered and notifications have no LED to
light. Set `grid.serialosc.autostart: true` and `beeper start` will start
it for you: beeper checks whether UDP 12002 is already bound, spawns
`grid.serialosc.command` (default `["serialoscd"]`) if not, waits for the
port to come up, then connects the grid. A serialoscd beeper spawned is
stopped when beeper exits; one already running is left alone.

If serialoscd was built into `/usr/local` and its device handler dies with
`libmonome.so.1: cannot open shared object file`, the linker can't find
libmonome. Add its directory to the linker cache once:

```bash
sudo sh -c 'echo /usr/local/lib64 > /etc/ld.so.conf.d/local-lib64.conf && ldconfig'
```

## Firing notifications

- **Webhook:** `curl -X POST http://127.0.0.1:8420/notify/<channel-id>`
  (add `-H "Authorization: Bearer $BEEPER_TOKEN"` if a token is set).
- **Poll:** beeper GETs `url` every `interval` seconds and fires when the
  `when` expression transitions to true. `when` supports `$.path`
  comparisons, e.g. `$.count > 0`, `$.status == "open"`, `$.items[0].n >= 2`.
- **RSS:** beeper checks the feed every `interval` seconds and fires when a
  new item appears.

## Gmail

Gmail's old unread-mail Atom feed (`mail.google.com/mail/u/0/feed/atom/`)
needs a live browser session and returns 401 to a plain server-side
request, so it doesn't work as an `rss` trigger. `gmail-bridge`, included
in this package, does the Gmail API's OAuth2 exchange and exposes unread
count on a local endpoint that a `poll` trigger can use instead.

One-time setup:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project, enable the Gmail API, and create an OAuth 2.0 Client ID of
   type **Desktop app**. Download the resulting JSON and save it as
   `~/.config/beeper/gmail-client.json`.
2. Run `gmail-bridge auth`. This opens your browser to Google's consent
   screen and saves a refresh token to `~/.config/beeper/gmail-token.json`.
3. Run `gmail-bridge start` to serve unread count on
   `http://localhost:9000/unread` (`--port`/`--query` to change the port
   or the Gmail search query; default query is `label:UNREAD in:inbox`).

Then point a `poll` channel at it, exactly like the `mail` example in
`config.example.yaml`:

```yaml
- id: mail
  button: [1, 0]
  trigger:
    type: poll
    url: "http://localhost:9000/unread"
    interval: 60
    when: "$.count > 0"
  raise: { run: "thunderbird" }
```

### Autostarting the bridge

Rather than running `gmail-bridge start` in a separate tab, list it under
`bridges` and `beeper start` launches it for you. Before each bridge's
channels come up, beeper probes its `health` URL: if something already
answers there, beeper leaves it alone; otherwise it spawns `command`,
waits for `health` to respond, then continues. Bridges beeper spawns are
stopped when beeper exits.

```yaml
bridges:
  - id: gmail
    command: ["gmail-bridge", "start"]
    health: "http://localhost:9000/unread"
```

The one-time `gmail-bridge auth` step above still has to be done by hand;
beeper can't drive the browser consent screen. Until a refresh token
exists, an autostarted bridge starts but answers `502`, so the `mail`
channel stays quiet.

## Ideas for more triggers

Channels beyond the built-in webhook/poll/rss shapes, grouped by what
they need:

- **`rss`, no bridge needed:** YouTube channel uploads (every channel has
  an Atom feed), GitHub repo commits/releases (`.../commits/main.atom`),
  subreddits, Mastodon profiles, most blogs and podcasts.
- **`poll` against a plain JSON API, no auth bridge needed:** weather
  (rain chance or temperature threshold), crypto/stock price threshold,
  status pages flipping off "operational," package tracking, a local
  script exposing disk space or CPU temperature as JSON.
- **`poll` needing a small OAuth bridge**, a separate local process that
  holds a token and serves a plain JSON endpoint, the same shape as
  Gmail unread counting: Google Calendar ("meeting starts in under N
  minutes"), GitHub notification count (mentions, review requests), Slack
  unread mentions/DMs, Todoist/Things task count.
- **`webhook`, these push natively:** GitHub/GitLab (PR opened, CI
  failed, review requested), Sentry (new error group), PagerDuty/Opsgenie
  (incident triggered), Stripe (payment events), Home Assistant (any
  sensor or automation posting straight to beeper's endpoint).

## How it works

serialosc discovers the grid over USB and exposes it via OSC. beeper uses
the `monome-grid` package to talk to serialosc, runs a render loop that
pulses pending buttons, and performs the raise action on press.

## Platform notes

Raising is `open` (URL) or `run` (command), which work on Linux, macOS, and
Windows. Focusing a native application window is not built in; on Linux
Wayland that is compositor-specific. Use a `run` action with your own focus
command if your environment supports it.

A grid plugged in after `beeper start` runs will connect and start
rendering. A grid unplugged mid-session is not detected: the underlying
`monome-grid` library has no device-removed event, so beeper will not
notice the disconnect or automatically reconnect. Restart beeper after
reconnecting a grid.

## Development

```bash
npm test          # run the vitest suite
npm run test:watch
```
