import { readFile } from 'node:fs/promises';
import { PUBLISHERS, validateFeed } from '../web/publishing.js';
for (const kind of Object.keys(PUBLISHERS)) {
  const feed = validateFeed(JSON.parse(await readFile(PUBLISHERS[kind].path, 'utf8')), kind);
  console.log(`${kind}: revision ${feed.revision}, ${feed.cards.length} published cards`);
}
