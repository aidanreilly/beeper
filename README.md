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

A webhook channel is also how desktop apps reach the grid: `desktop-notify-bridge`
turns each app's desktop notification into a POST, so Slack, Gmail, Calendar and
the rest light their own buttons with no API or email in the loop. See [Bridging
desktop notifications](#bridging-desktop-notifications).

## Bridging desktop notifications

When an app has no feed, its API sits behind an admin, and its email lands
somewhere you can use the the desktop notification. 
On Linux that travels over the session D-Bus to `org.freedesktop.Notifications`. `desktop-notify-bridge` eavesdrops on that bus and POSTs beeper's webhook whenever an app you named posts a notification.
Nothing is installed into the workspace and no email has to reach you, so no
admin review enters into it, and the button lights the moment the app notifies
you rather than after an away delay.

One bridge routes many apps. Rules live in
`~/.config/beeper/notify-rules.yaml` (copy `config.notify-rules.example.yaml`),
each mapping an app-name pattern to a beeper channel:

```yaml
webhook:
  url: http://127.0.0.1:8420
  token: ${BEEPER_TOKEN}   # optional
debounce: 2                # seconds; collapse the bus's duplicate Notify
rules:
  - app: "^Slack$"
    channel: slack
  - app: "^Gmail$"
    channel: mail
  - app: "^Google Calendar$|Evolution Reminders"
    channel: calendar
```

`app` is a case-insensitive regex on the notifying app's name; add a `summary`
or `body` regex to narrow a busy source. First match wins, and `channel` has
to name a `webhook` channel in `config.yaml`:

```yaml
- id: slack
  button: [2, 0]
  trigger: { type: webhook }
  raise: { open: "https://app.slack.com/client" }
```

To learn what an app calls itself on the bus, run the bridge in print mode and
trigger one notification from it:

```bash
node bin/desktop-notify-bridge.js --print
```

That logs `app="..." summary="..." body="..."` for every notification, and the
`app` string is what your pattern matches. The name is often the app's own
(`Slack`, `Gmail`), a browser PWA's name (`Google Calendar`, `Docs`), the
browser itself (`Google Chrome`), or a system component (`Problem Reporting`).

The bridge runs alongside the desktop for the length of your session, so a
systemd user service fits:

```ini
# ~/.config/systemd/user/beeper-desktop-notify.service
[Unit]
Description=beeper desktop-notification router
After=graphical-session.target
PartOf=graphical-session.target

[Service]
# systemd user units don't get the nvm PATH, so give node's absolute path.
# Find yours with: command -v node
ExecStart=%h/.nvm/versions/node/v20.18.1/bin/node %h/fun/beeper/bin/desktop-notify-bridge.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now beeper-desktop-notify.service
```

`Restart=always` earns its place: if `dbus-monitor` exits, the bridge exits
cleanly, and you still want it back. One tradeoff comes with the approach.
Routing rides each app's own notifications, so it honours whatever you have
muted or focused in that app, and a channel goes quiet when its app is closed.
A `poll` bridge counts unread mail whether or not the app is open; a
desktop-notification channel fires only while the app is running to post it.

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
  unread mentions/DMs, Todoist/Things task count. For an app whose API is
  gated behind an install or an admin, its notification email is often the
  easier route ([Notifying on app email](#notifying-on-app-email)), and
  failing that its desktop notification ([Bridging desktop
  notifications](#bridging-desktop-notifications)).
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
