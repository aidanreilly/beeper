import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import { z } from 'zod';

const raiseSchema = z
  .object({ open: z.string().optional(), run: z.string().optional() })
  .refine((r) => (r.open ? 1 : 0) + (r.run ? 1 : 0) === 1, {
    message: 'raise must have exactly one of "open" or "run"',
  });

const triggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('webhook') }),
  z.object({
    type: z.literal('poll'),
    url: z.string().url(),
    interval: z.number().positive(),
    when: z.string().min(1),
  }),
  z.object({
    type: z.literal('rss'),
    url: z.string().url(),
    interval: z.number().positive(),
  }),
]);

const channelSchema = z.object({
  id: z.string().min(1),
  button: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  trigger: triggerSchema,
  raise: raiseSchema,
});

// zod v4 note: `.default({})` on an object schema does NOT re-parse `{}`
// through that schema (unlike zod v3) — it installs `{}` verbatim, so any
// defaults nested inside are skipped. The fix is to pass the schema's own
// *already-resolved* empty parse as the default value instead of a bare `{}`.
const brightnessSchema = z.object({
  idle: z.number().int().min(0).max(15).default(0),
  blink_low: z.number().int().min(0).max(15).default(3),
  blink_high: z.number().int().min(0).max(15).default(14),
  confirm: z.number().int().min(0).max(15).default(15),
});

const gridSchema = z.object({
  device: z.string().nullable().default(null),
  rows: z.number().int().positive().default(8),
  cols: z.number().int().positive().default(16),
  blink_hz: z.number().positive().default(0.7),
  varibright: z.boolean().default(true),
  brightness: brightnessSchema.default(brightnessSchema.parse({})),
});

const webhookSchema = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().int().positive().default(8420),
  token: z.string().optional(),
});

const configSchema = z.object({
  grid: gridSchema.default(gridSchema.parse({})),
  webhook: webhookSchema.default(webhookSchema.parse({})),
  channels: z.array(channelSchema).min(1),
});

function resolveEnv(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => process.env[name] ?? '');
  }
  if (Array.isArray(value)) return value.map(resolveEnv);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveEnv(v)]));
  }
  return value;
}

export function parseConfig(text) {
  const raw = resolveEnv(YAML.parse(text) ?? {});
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid config:\n${issues}`);
  }
  const cfg = parsed.data;

  const ids = new Set();
  const buttons = new Set();
  for (const ch of cfg.channels) {
    if (ids.has(ch.id)) throw new Error(`Invalid config: duplicate channel id "${ch.id}"`);
    ids.add(ch.id);
    const [x, y] = ch.button;
    if (x < 0 || x >= cfg.grid.cols || y < 0 || y >= cfg.grid.rows) {
      throw new Error(
        `Invalid config: channel "${ch.id}" button [${x},${y}] is outside the grid (${cfg.grid.cols}x${cfg.grid.rows})`,
      );
    }
    const key = `${x},${y}`;
    if (buttons.has(key)) {
      throw new Error(`Invalid config: button [${key}] already assigned (channel "${ch.id}")`);
    }
    buttons.add(key);
  }
  return cfg;
}

export function loadConfig(path) {
  return parseConfig(readFileSync(path, 'utf8'));
}
