import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLE_PACK, parseStudyPack } from '../web/pack.js';
import { publishedCards } from '../web/publishing.js';
import { readFile } from 'node:fs/promises';

test('plain text imports sentences and mistakes without an id', () => {
  const cards = parseStudyPack(EXAMPLE_PACK);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].kind, 'reading');
  assert.equal(cards[0].focus, 'congested');
  assert.equal(cards[0].personalError, '把 congested 看成了 congest');
  assert.equal(cards[0].origin, '我的导入');
  assert.equal(cards[1].kind, 'listening');
  assert.equal(cards[1].selfStudy, true);
  assert.equal(cards[1].lessonId, undefined);
  assert.deepEqual(parseStudyPack(EXAMPLE_PACK).map(c => c.id), cards.map(c => c.id));
});

test('a sentence without a focus is practised as a whole sentence', () => {
  const [card] = parseStudyPack('出处: 剑雅 16 · Test 1 · Passage 3\n原句: The remains of the old station were incorporated into the new line.');
  assert.equal(card.focus, card.sentence);
  assert.equal(card.target, card.sentence);
  assert.equal(card.kind, 'reading');
});

test('one invalid item rejects the whole pack', () => {
  assert.throws(() => parseStudyPack('原句: Only a sentence, no source.'), /出处/);
  assert.throws(() => parseStudyPack('{"schemaVersion":2,"cards":[]}'), /schemaVersion/);
  assert.equal(parseStudyPack('```json\n{"cards":[{"kind":"reading","source":"剑雅 15 · Test 1 · Passage 1","sentence":"Glass was already in use.","focus":"Glass"}]}\n```')[0].focus, 'Glass');
});

test('listening import keeps an audio filename and clip times', () => {
  const [card] = parseStudyPack('# 听力\n出处: 剑雅 15 · Test 1 · Section 2\n原句: I would like to book a single room.\n音频: My Clips/room.mp3\n开始: 64\n结束: 71');
  assert.equal(card.audioName, 'room.mp3');
  assert.equal(card.audioStart, 64);
  assert.equal(card.audioEnd, 71);
  assert.equal(card.selfStudy, true);
  const [remote] = parseStudyPack('# 听力\n出处: 剑雅 15 · Test 1 · Section 2\n原句: The tour starts at nine.\n音频: https://cdn.example.com/tour.mp3\n开始: 1\n结束: 4');
  assert.equal(remote.audio.url, 'https://cdn.example.com/tour.mp3');
  assert.equal(remote.audioName, undefined);
  assert.throws(() => parseStudyPack('# 听力\n出处: 剑雅 15 · Test 1 · Section 1\n原句: Hello there.\n音频: https://cdn.example.com/a.mp3'), /开始/);
});

test('personal listening without a lesson stays available beside the built-in courses', async () => {
  const feed = JSON.parse(await readFile(new URL('../content/listening.json', import.meta.url), 'utf8'));
  const [mine] = parseStudyPack('# 听力\n出处: 我的 Section 1\n原句: Can I book a table for two?');
  const visible = publishedCards(feed.cards, {}, [mine]);
  assert.ok(visible.some(c => c.id === mine.id));
  const legacy = { ...feed.cards[0], id: 'old-feedback' };
  delete legacy.lessonId;
  delete legacy.order;
  assert.equal(publishedCards([legacy, ...feed.cards], {}).some(c => c.id === 'old-feedback'), false);
});
