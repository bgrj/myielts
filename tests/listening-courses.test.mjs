import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateFeed, publishedCards, botInstructions } from '../web/publishing.js';
import { lessonQueue } from '../web/listening.js';
import { emptyState, schedule, queueFor } from '../web/core.js';
const feed=validateFeed(JSON.parse(await readFile('content/listening.json','utf8')),'listening');
const manifest=JSON.parse(await readFile('content/listening-audio-manifest.json','utf8'));

test('both complete originals preserve announcer, example, conversation and closing in source order',async()=>{
  assert.deepEqual(feed.lessons.slice(0,2).map(l=>[l.id,l.sentenceCount,l.announcerCount]),[['self-drive',116,23],['leisure-club',41,8]]);
  const source=JSON.parse(await readFile('content/listening-source-transcripts.json','utf8'));
  for(const l of source.lessons){
    const group=feed.cards.filter(c=>c.lessonId===l.id);
    assert.deepEqual(group.map(c=>c.sentence),l.sentences.map(c=>c.sentence));
    assert.equal(group[0].speaker,'ANNOUNCER');assert.equal(group.at(-1).speaker,'ANNOUNCER');
    assert.ok(group.at(-1).sentence.includes('check your answers'));
  }
  assert.equal(manifest.clips.length,feed.cards.length);
  for(const clip of manifest.clips){
    const bytes=await readFile(clip.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),clip.sha256);
    assert.equal(bytes.length,clip.bytes);assert.ok(clip.duration>.2&&clip.duration<40);
    assert.ok(clip.sourceEnd>clip.sourceStart);
  }
});
test('dictation resumes with the next unpractised sentence and reviews due sentences in original order',()=>{
  const state=emptyState(),now=Date.now(),all=lessonQueue(feed.cards,state,'self-drive');
  assert.equal(all.length,116);assert.equal(all[0].speaker,'ANNOUNCER');
  for(const c of all.slice(0,4))state.progress[c.id]=schedule(null,'good',now);
  assert.equal(lessonQueue(feed.cards,state,'self-drive')[0].order,5);
  state.progress[all[2].id].due=now-100;state.progress[all[0].id].due=now-10;
  assert.deepEqual(lessonQueue(feed.cards,state,'self-drive','review',now).map(c=>c.order),[1,3]);
  assert.equal(lessonQueue(feed.cards,state,'self-drive','restart').length,116);
  assert.ok(queueFor(feed.cards,state,now).every(c=>state.progress[c.id]),'daily queue must not silently start a later listening sentence');
});
test('partial feedback sets and third scenarios without an explicit request cannot replace courses',()=>{
  assert.throws(()=>validateFeed({...feed,cards:feed.cards.slice(1)},'listening'),/完整/);
  const third={...feed.cards[0],id:'third-1',lessonId:'third',order:1};
  const draft={...feed,cards:[...feed.cards,third],lessons:[...feed.lessons,{id:'third',title:'第三场景',source:'剑雅',sentenceCount:1,announcerCount:1}]};
  assert.throws(()=>validateFeed(draft,'listening'),/明确要求/);
  assert.ok(botInstructions('listening').includes('ANNOUNCER'));
  const legacy={...feed.cards[0],id:'old-feedback'};delete legacy.lessonId;delete legacy.order;
  assert.equal(publishedCards([legacy,...feed.cards],{}).length,feed.cards.length);
});
