import { describe, it, expect } from 'vitest';
import { parseBlock, createNotifyParser } from '../src/desktop-notify/parse.js';
import { compileRules, matchEvent } from '../src/desktop-notify/match.js';
import { loadRules } from '../src/desktop-notify/config.js';

// A real dbus-monitor capture: the Notify method call, then GNOME Shell
// forwarding the same call on to the shell portal. Two blocks, one event each.
const SLACK_CAPTURE = `method call time=1787737223.324289 sender=:1.540 -> destination=:1.33 serial=9 path=/org/freedesktop/Notifications; interface=org.freedesktop.Notifications; member=Notify
   string "Slack"
   uint32 0
   string ""
   string "Aidan Reilly"
   string "hey, can you review this?"
   array [
   ]
   array [
      dict entry(
         string "urgency"
         variant             byte 1
      )
      dict entry(
         string "sender-pid"
         variant             int64 1956938
      )
   ]
   int32 -1
method call time=1787737223.327211 sender=:1.33 -> destination=:1.22 serial=1734 path=/org/freedesktop/Notifications; interface=org.freedesktop.Notifications; member=Notify
   string "Slack"
   uint32 0
   string ""
   string "Aidan Reilly"
   string "hey, can you review this?"
   array [
   ]
   array [
      dict entry(
         string "x-shell-sender"
         variant             string ":1.540"
      )
   ]
   int32 -1`;

describe('notify parser', () => {
  it('extracts app, summary, and body and ignores hint strings', () => {
    const events = parseBlock(SLACK_CAPTURE);
    expect(events).toHaveLength(2); // the bus forwards the same Notify twice
    expect(events[0]).toEqual({
      app: 'Slack',
      icon: '',
      summary: 'Aidan Reilly',
      body: 'hey, can you review this?',
    });
    // the ":1.540" inside the hints array must not leak into the fields
    expect(events[1].body).toBe('hey, can you review this?');
  });

  it('does not emit for non-Notify traffic', () => {
    const events = [];
    const p = createNotifyParser((e) => events.push(e));
    p.push('signal time=1 sender=org.freedesktop.DBus -> destination=:1.5 member=NameAcquired');
    p.push('   string ":1.5"');
    p.flush();
    expect(events).toHaveLength(0);
  });
});

describe('rule matching', () => {
  const compiled = compileRules([
    { app: '^Docs$', channel: 'docs' },
    { app: 'Slack', channel: 'slack' },
    { app: 'Google Calendar|Evolution Reminders', channel: 'calendar' },
    { app: 'Gmail', summary: 'important', channel: 'mail' },
  ]);

  it('matches app name case-insensitively, first rule wins', () => {
    expect(matchEvent({ app: 'slack', summary: 'x', body: 'y' }, compiled)).toBe('slack');
  });

  it('anchors when the pattern is anchored', () => {
    expect(matchEvent({ app: 'Google Docs' }, compiled)).toBe(null);
    expect(matchEvent({ app: 'Docs' }, compiled)).toBe('docs');
  });

  it('honours an alternation across sources', () => {
    expect(matchEvent({ app: 'Evolution Reminders' }, compiled)).toBe('calendar');
  });

  it('requires the optional summary pattern when present', () => {
    expect(matchEvent({ app: 'Gmail', summary: 'newsletter' }, compiled)).toBe(null);
    expect(matchEvent({ app: 'Gmail', summary: 'Important: ...' }, compiled)).toBe('mail');
  });

  it('returns null when nothing matches', () => {
    expect(matchEvent({ app: 'Spotify' }, compiled)).toBe(null);
  });
});

describe('rules config', () => {
  const read = (text) => (_p, _enc) => text;

  it('parses rules and defaults the webhook url', () => {
    const cfg = loadRules('x', {
      readFile: read('rules:\n  - app: Slack\n    channel: slack\n'),
    });
    expect(cfg.webhook.url).toBe('http://127.0.0.1:8420');
    expect(cfg.debounce).toBe(2);
    expect(cfg.rules).toEqual([{ app: 'Slack', channel: 'slack' }]);
  });

  it('treats an unset token env as no auth', () => {
    delete process.env.BEEPER_TOKEN_TEST;
    const cfg = loadRules('x', {
      readFile: read('webhook:\n  token: ${BEEPER_TOKEN_TEST}\nrules: []\n'),
    });
    expect(cfg.webhook.token).toBeUndefined();
  });
});
