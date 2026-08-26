import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import { z } from 'zod';

const schema = z.object({
  webhook: z
    .object({
      url: z.string().url().default('http://127.0.0.1:8420'),
      // may arrive as null/'' when ${VAR} expands to nothing; that means no auth
      token: z.string().nullable().optional(),
    })
    .default({ url: 'http://127.0.0.1:8420' }),
  debounce: z.number().nonnegative().default(2),
  rules: z
    .array(
      z.object({
        app: z.string().min(1),
        summary: z.string().optional(),
        body: z.string().optional(),
        channel: z.string().min(1),
      }),
    )
    .default([]),
});

// Same ${VAR} expansion beeper's own config uses, so a token can come from the
// environment. An unset variable expands to empty, which reads as no auth.
function expandEnv(text) {
  return text.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => process.env[name] ?? '');
}

export function loadRules(path, { readFile = readFileSync } = {}) {
  const data = YAML.parse(expandEnv(readFile(path, 'utf8'))) ?? {};
  const cfg = schema.parse(data);
  if (!cfg.webhook.token) delete cfg.webhook.token; // null or '' => no auth
  return cfg;
}
