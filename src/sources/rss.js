export function createRssSource(
  channel,
  emit,
  { parser, setTimer = setInterval, clearTimer = clearInterval } = {},
) {
  const { url, interval } = channel.trigger;
  let marker = null;
  let seeded = false;
  let handle = null;

  const idOf = (item) => item?.guid || item?.link || item?.title || null;

  async function check() {
    try {
      const feed = await parser.parseURL(url);
      const newest = idOf(feed.items?.[0]);
      if (!seeded) {
        marker = newest;
        seeded = true;
        return;
      }
      if (newest && newest !== marker) {
        emit(channel.id);
        marker = newest;
      }
    } catch (err) {
      console.error(`rss "${channel.id}" failed:`, err.message);
    }
  }

  function start() {
    handle = setTimer(check, interval * 1000);
  }

  function stop() {
    if (handle) clearTimer(handle);
    handle = null;
  }

  return { start, stop };
}
