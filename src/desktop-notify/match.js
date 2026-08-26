// Compile notification-routing rules and match events against them.
//
// A rule matches on the notification's app name, and optionally its summary
// or body, all as case-insensitive regular expressions. The first rule that
// matches wins, and its `channel` is the beeper channel to fire.

export function compileRules(rules) {
  return rules.map((r) => ({
    channel: r.channel,
    app: new RegExp(r.app, 'i'),
    summary: r.summary ? new RegExp(r.summary, 'i') : null,
    body: r.body ? new RegExp(r.body, 'i') : null,
  }));
}

export function matchEvent(event, compiled) {
  for (const r of compiled) {
    if (!r.app.test(event.app)) continue;
    if (r.summary && !r.summary.test(event.summary || '')) continue;
    if (r.body && !r.body.test(event.body || '')) continue;
    return r.channel;
  }
  return null;
}
