import RssParser from 'rss-parser';
import { createWebhookSource } from './webhook.js';
import { createPollSource } from './poll.js';
import { createRssSource } from './rss.js';

export function createSources({ config, emit, deps = {} }) {
  const sources = [];
  const byType = { webhook: [], poll: [], rss: [] };
  for (const ch of config.channels) byType[ch.trigger.type].push(ch);

  if (byType.webhook.length > 0) {
    sources.push(createWebhookSource({ channels: byType.webhook, webhook: config.webhook, emit }));
  }
  for (const ch of byType.poll) {
    sources.push(createPollSource(ch, emit, deps));
  }
  if (byType.rss.length > 0) {
    const parser = deps.parser ?? new RssParser();
    for (const ch of byType.rss) {
      sources.push(createRssSource(ch, emit, { ...deps, parser }));
    }
  }
  return sources;
}
