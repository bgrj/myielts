import { PUBLISHERS, acceptFeed, validateFeed } from './publishing.js';
import { timeoutRequest } from './compat.js';

export class FeedClient {
  constructor({ baseUrl, storage, fetcher = (...args) => globalThis.fetch(...args), onUpdate = () => {} }) {
    this.baseUrl = baseUrl; this.storage = storage; this.fetcher = fetcher; this.onUpdate = onUpdate;
    this.feeds = {}; this.status = {}; this.key = 'myielts.published.v1'; this.inflight = null;
    try {
      const saved = JSON.parse(storage?.getItem(this.key) || '{}');
      for (const kind of Object.keys(PUBLISHERS)) {
        try { if (saved[kind]) { this.feeds[kind] = validateFeed(saved[kind], kind); this.status[kind] = 'cached'; } }
        catch { this.status[kind] = 'invalid-cache'; }
      }
    } catch { /* Valid cards from the bundled library remain available. */ }
  }
  async refresh() {
    if (this.inflight) return this.inflight;
    this.inflight = this.run();
    try { return await this.inflight; } finally { this.inflight = null; }
  }
  async run() {
    const next = { ...this.feeds }; let changed = false;
    const failures = {};
    await Promise.all(Object.keys(PUBLISHERS).map(async kind => {
      const timeout = timeoutRequest();
      try {
        const url = new URL(`feeds/${kind}.json`, this.baseUrl);
        url.searchParams.set('v', String(Date.now()));
        const response = await this.fetcher(url, { cache: 'no-store', credentials: 'omit', signal: timeout.signal });
        if (!response.ok) throw new Error(`内容源 HTTP ${response.status}`);
        const raw = await response.text();
        if (raw.length > 2 * 1024 * 1024) throw new Error('单个内容源超过 2 MB');
        const feed = acceptFeed(this.feeds[kind], JSON.parse(raw), kind);
        changed ||= JSON.stringify(feed) !== JSON.stringify(this.feeds[kind]);
        next[kind] = feed; this.status[kind] = 'online';
      } catch (error) { failures[kind] = error.message; this.status[kind] = this.feeds[kind] ? 'cached-error' : 'unavailable'; }
      finally { timeout.clear(); }
    }));
    this.feeds = next;
    try { this.storage?.setItem(this.key, JSON.stringify(next)); } catch { /* Keep current session usable. */ }
    this.onUpdate({ feeds: next, changed, failures, status: { ...this.status } });
    return { feeds: next, changed, failures };
  }
}
