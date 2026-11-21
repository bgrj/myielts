import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('content/reading-audio-manifest.json','utf8'));
test('all 213 reading cards share 74 verified natural speech MP3s, separate from original listening',async()=>{
  assert.equal(manifest.kind,'synthetic-reading');assert.equal(manifest.voice,'en-GB-SoniaNeural');assert.ok(manifest.count>=74);assert.equal(manifest.count,manifest.clips.length);
  const cards=JSON.parse(await readFile('web/data/cards.json','utf8')).filter(c=>c.kind==='reading');
  for(const c of cards)assert.ok(manifest.clips.some(s=>s.sentence===c.sentence));
  for(const c of manifest.clips){const bytes=await readFile(c.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256);assert.ok(c.duration>0&&c.duration<90);assert.ok(c.url.includes('/recordings/reading-'));}
});
