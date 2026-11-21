import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateFeed, acceptFeed, publishedCards, preparePublication, PUBLISHERS, botInstructions } from '../web/publishing.js';
import { FeedClient } from '../web/feed-client.js';
import { emptyState, schedule, validateBackup } from '../web/core.js';

const base = JSON.parse(await readFile(new URL('../web/data/cards.json', import.meta.url), 'utf8'));
const reading = validateFeed(JSON.parse(await readFile(new URL('../content/reading.json', import.meta.url), 'utf8')), 'reading');
const listening = validateFeed(JSON.parse(await readFile(new URL('../content/listening.json', import.meta.url), 'utf8')), 'listening');
const clone = value => structuredClone(value);
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}
test('real screenshot feedback is mapped to existing cards, not duplicate lessons', () => {
  assert.ok(reading.cards.length >= 6); assert.ok(listening.cards.length >= 157);
  assert.ok(publishedCards(base, { reading, listening }).length >= 370);
  assert.ok(reading.cards.find(c => c.target === 'versatile').feedback.includes('再加几个'));
  assert.ok(listening.lessons.length >= 2); assert.equal(listening.cards[0].speaker, 'ANNOUNCER');
});
test('publication requires verified original context, feedback and translation', () => {
  for (const key of ['feedback', 'translation', 'originalRef', 'note']) {
    const bad = clone(reading); bad.cards[0][key] = ''; assert.throws(() => validateFeed(bad, 'reading'));
  }
  const bad = clone(reading); bad.cards[0].sourceVerified = false;
  assert.throws(() => validateFeed(bad, 'reading'));
});
test('bots cannot publish into the other source or overwrite its type', () => {
  assert.throws(() => validateFeed(reading, 'listening'));
  assert.throws(() => validateFeed({ ...reading, botId: listening.botId }, 'reading'));
  assert.throws(() => validateFeed({ ...reading, cards: [listening.cards[0]] }, 'reading'));
});
test('versions never roll back or mutate in place', () => {
  assert.throws(() => acceptFeed(reading, { ...reading, revision: 0 }, 'reading'));
  assert.throws(() => acceptFeed(reading, { ...reading, updatedAt: '2026-11-22T01:00:00Z' }, 'reading'));
  assert.deepEqual(acceptFeed(reading, clone(reading), 'reading'), reading);
});
test('additional feedback merges into same id, keeps older cards, increments revision', () => {
  const card = { ...reading.cards[0], grammar: '新增针对原句的语法说明' };
  const saved = preparePublication(reading, { schemaVersion: 1, kind: 'reading', botId: reading.botId, cards: [card] }, base, '2026-11-21T15:00:00Z');
  assert.equal(saved.cards.length, reading.cards.length);
  assert.equal(saved.revision, reading.revision + 1);
  assert.equal(saved.publisher, 'grok');
  assert.equal(saved.cards.find(c => c.id === card.id).grammar, card.grammar);
});
test('publisher finds semantic duplicates and tells the bot the stable id', () => {
  const duplicate = { ...reading.cards[0], id: 'different-id' };
  assert.throws(() => preparePublication(reading, { schemaVersion: 1, kind: 'reading', botId: reading.botId, cards: [duplicate] }, base), /沿用 id/);
});
test('updated knowledge does not mutate learner progress; local edits stay primary', () => {
  const state = emptyState(), card = reading.cards[0];
  state.progress[card.id] = schedule(null, 'good', 10000); state.favorites = [card.id];
  const before = clone(state);
  const merged = publishedCards(base, { reading }, [{ ...card, note: '我的个人补充' }]);
  assert.equal(merged.find(c => c.id === card.id).note, '我的个人补充');
  assert.deepEqual(state, before);
});
test('restoring a full backup preserves snapshots without masking future bot updates', () => {
  const state = emptyState();
  const all = publishedCards(base, { reading });
  const custom = { ...reading.cards[0], note: '个人专属编辑' };
  const backup = { ...state, cards: all.map(c => c.id === custom.id ? custom : c), localCardIds: [custom.id] };
  const restored = validateBackup(backup);
  assert.equal(restored.cards.length, 1);
  assert.equal(restored.librarySnapshot.length, 212);
  const remote = clone(reading); remote.cards[1].note = '恢复后 bot 的新解释';
  const merged = publishedCards([...base, ...restored.librarySnapshot], { reading: remote }, restored.cards);
  assert.equal(merged.find(c => c.id === remote.cards[1].id).note, '恢复后 bot 的新解释');
  assert.equal(merged.find(c => c.id === custom.id).note, custom.note);
});
test('original audio supports exact segments, rejects unsafe links and invalid ranges', () => {
  const card = { ...listening.cards[0], audio: { url: 'https://example.com/original.mp3', start: 12.5, end: 16 } };
  assert.equal(validateFeed({ ...listening, cards: [card, ...listening.cards.slice(1)] }, 'listening').cards[0].audio.start, 12.5);
  for (const audio of [{ url: 'javascript:alert(1)', start: 0, end: 1 }, { url: 'https://x:y@example.com/a.mp3', start: 0, end: 1 }, { url: 'https://example.com/a.mp3', start: 5, end: 3 }, { url: 'https://example.com/a.mp3', start: 0, end: 301 }]) assert.throws(() => validateFeed({ ...listening, cards: [{ ...card, audio }] }, 'listening'));
});
test('live fetch validates each source, saves offline cache and deduplicates parallel checks', async () => {
  let requests = 0, updates = 0;
  const cache = storage();
  const client = new FeedClient({ baseUrl: 'https://ourbeings.com/ielts/', storage: cache, fetcher: async url => { requests++; assert.ok(url.pathname.startsWith('/ielts/feeds/')); assert.ok(url.searchParams.has('v')); return new Response(JSON.stringify(url.pathname.includes('reading') ? reading : listening)); }, onUpdate: () => updates++ });
  await Promise.all([client.refresh(), client.refresh()]);
  assert.equal(requests, 2); assert.equal(updates, 1);
  const restored = new FeedClient({ baseUrl: client.baseUrl, storage: cache });
  assert.deepEqual(restored.feeds.reading, reading);
  assert.equal(restored.status.listening, 'cached');
});
test('a failed or malformed feed keeps last valid notes while the other source updates', async () => {
  const cache = storage({ 'myielts.published.v1': JSON.stringify({ reading, listening }) });
  const nextListening = { ...listening, revision: listening.revision + 1 };
  const client = new FeedClient({ baseUrl: 'https://ourbeings.com/ielts/', storage: cache, fetcher: async url => new Response(JSON.stringify(url.pathname.includes('reading') ? { ...reading, cards: [{ id: 'broken' }] } : nextListening)) });
  const result = await client.refresh();
  assert.ok(result.failures.reading);
  assert.deepEqual(client.feeds.reading, reading);
  assert.equal(client.feeds.listening.revision, nextListening.revision);
});
test('bot instructions request a real authenticated write and verification, scoped to own source', () => {
  for (const kind of Object.keys(PUBLISHERS)) {
    const instruction = botInstructions(kind);
    assert.ok(instruction.includes(PUBLISHERS[kind].path));
    assert.ok(instruction.includes('sourceVerified:true'));
    assert.ok(instruction.includes('不能虚称已发布'));
    assert.ok(instruction.includes('https://ourbeings.com/ielts/'));
  }
});
