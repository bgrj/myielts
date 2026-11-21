const PREFIX = 'myielts-' + new URL(self.registration.scope).pathname.replaceAll('/', '_') + '-';
const CACHE = PREFIX + 'myielts-v1-20261121';
const AUDIO_CACHE = PREFIX + 'original-audio-v1';
const SHELL = ['./', './index.html', './style.css', './app.js', './core.js', './publishing.js', './feed-client.js', './data/cards.json', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function originalAudioResponse(request) {
  const url = new URL(request.url); url.hash = '';
  const key = new Request(url.href);
  const cache = await caches.open(AUDIO_CACHE);
  let response = await cache.match(key);
  if (!response) {
    response = await fetch(key);
    if (response.status !== 200) return response;
    const size = Number(response.headers.get('Content-Length') || 0);
    if (size > 5 * 1024 * 1024) return response;
    try { await cache.put(key, response.clone()); } catch { /* Playback still works if device storage is full. */ }
  }
  const range = request.headers.get('Range');
  if (!range) return response;
  const bytes = await response.arrayBuffer(), length = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${length}` } });
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (start >= length || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${length}` } });
  return new Response(bytes.slice(start, end + 1), { status: 206, headers: { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${length}` } });
}
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const path = new URL(event.request.url).pathname;
  if (!event.request.url.startsWith(self.registration.scope) || path.startsWith(new URL('./feeds/', self.registration.scope).pathname)) return;
  if (path.startsWith(new URL('./recordings/', self.registration.scope).pathname)) { event.respondWith(originalAudioResponse(event.request)); return; }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request).then(response => {
    // Only cache known shell URLs; never imported user files or unrelated pages.
    return response;
  })));
});
