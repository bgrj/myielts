import { access, cp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of await readdir('web')) await cp(`web/${file}`, `dist/${file}`, { recursive: true });
const listening = JSON.parse(await readFile('web/data/listening.json', 'utf8'));
await mkdir('dist/recordings', { recursive: true });
let recordings = 0;
for (const card of listening.cards) {
  const name = new URL(card.audio.url).pathname.split('/').pop();
  try {
    await access(`content/audio/${name}`);
    await cp(`content/audio/${name}`, `dist/recordings/${name}`);
    recordings++;
  } catch { /* A clip that is not in this build keeps loading through the recordings rewrite. */ }
}
console.log(`Copied ${recordings} original recordings`);
const hash = createHash('sha256');
for (const file of ['index.html', 'style.css', 'app.js', 'core.js', 'pack.js', 'audio-store.js', 'i18n.js', 'compat.js', 'publishing.js', 'feed-client.js', 'listening.js', 'data/cards.json', 'data/listening.json', 'data/reading-audio.json', 'manifest.webmanifest', 'icon.svg', 'wechat-feedback.png']) hash.update(await readFile(`dist/${file}`));
const sw = await readFile('dist/sw.js', 'utf8');
await writeFile('dist/sw.js', sw.replace('myielts-v1-20261122f', `myielts-${hash.digest('hex').slice(0, 16)}`));
console.log('Built static site in dist/');
