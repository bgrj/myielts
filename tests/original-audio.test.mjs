import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateFeed, publishedCards } from '../web/publishing.js';
import { queueFor, emptyState } from '../web/core.js';
const cards=JSON.parse(await readFile('web/data/cards.json','utf8'));
const manifest=JSON.parse(await readFile('content/audio-manifest.json','utf8'));
test('all 38 listening cards have verified original voice files with correct hashes',async()=>{
  assert.equal(manifest.count,38);assert.equal(cards.filter(c=>c.kind==='listening').length,38);
  for(const clip of manifest.clips){
    const file=await readFile(clip.path);
    assert.equal(createHash('sha256').update(file).digest('hex'),clip.sha256);
    assert.equal(file.length,clip.bytes);
    const card=cards.find(c=>c.id===clip.id);
    assert.ok(card.audio.url.endsWith(clip.path.split('/').pop()));
    assert.equal(card.sentence,clip.sentence);assert.equal(card.audio.end,clip.duration);
    assert.ok(clip.duration>0&&clip.duration<15&&clip.sourceEnd>clip.sourceStart);
    assert.ok(card.audioSource&&card.sourceVerified);
  }
});
test('a listening publication without original audio is rejected, not synthesized',async()=>{
  const feed=JSON.parse(await readFile('content/listening.json','utf8'));
  assert.equal(validateFeed(feed,'listening').cards.length,157);
  const bad=structuredClone(feed);delete bad.cards[0].audio;
  assert.throws(()=>validateFeed(bad,'listening'),/原音/);
});
test('old backup snapshots keep the verified original for an unchanged sentence',async()=>{
  const original=JSON.parse(await readFile('content/listening.json','utf8')).cards[0];const legacy={...original,note:'旧备份中的个人补充'};delete legacy.audio;delete legacy.audioSource;
  const merged=publishedCards([original,legacy],{});
  assert.deepEqual(merged[0].audio,original.audio);assert.equal(merged[0].note,legacy.note);
  const unavailable={...original,id:'pending-listening'};delete unavailable.audio;
  assert.equal(queueFor([unavailable],emptyState()).length,0);
});
