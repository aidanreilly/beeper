// Parse `dbus-monitor` text output into Notify events.
//
// The org.freedesktop.Notifications Notify signature is
//   (app_name, replaces_id, app_icon, summary, body, actions, hints, timeout)
// so the scalar arguments before the first array, in order, are the strings
// app_name, app_icon, summary, body (with a uint32 replaces_id between the
// first two). We read those four and stop at the first `array [`, which is
// `actions`; everything after (including the hints array, whose dict entries
// also contain strings) is ignored.

const HEADER = /^(method call|signal|error|method return)\b/;
const IS_NOTIFY = /member=Notify\b/;
const STRING_ARG = /^\s*string "(.*)"$/;
const ARRAY_OPEN = /^\s*array \[/;

export function createNotifyParser(onEvent) {
  let collecting = false;
  let strings = [];

  function flush() {
    if (collecting && strings.length) {
      onEvent({
        app: strings[0] ?? '',
        icon: strings[1] ?? '',
        summary: strings[2] ?? '',
        body: strings[3] ?? '',
      });
    }
    collecting = false;
    strings = [];
  }

  function push(line) {
    if (HEADER.test(line)) {
      flush(); // a new message closes any Notify we were mid-read on
      if (line.startsWith('method call') && IS_NOTIFY.test(line)) {
        collecting = true;
        strings = [];
      }
      return;
    }
    if (!collecting) return;
    if (ARRAY_OPEN.test(line)) {
      flush(); // first array is `actions`; the scalar args are complete
      return;
    }
    const m = line.match(STRING_ARG);
    if (m) strings.push(m[1]);
  }

  return { push, flush };
}

// Convenience for tests: parse a whole captured block into events.
export function parseBlock(text) {
  const events = [];
  const parser = createNotifyParser((e) => events.push(e));
  for (const line of text.split('\n')) parser.push(line);
  parser.flush();
  return events;
}
