import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DAY, dayKey, schedule, queueFor, emptyState, validateCards, validateBackup, mergeBackup, checkAnswer } from '../web/core.js';
const data = JSON.parse(await readFile(new URL('../web/data/cards.json', import.meta.url), 'utf8'));
const now = Date.parse('2026-11-21T10:00:00Z');
test('251 genuine personal cards have complete context and translation', () => {
  assert.equal(validateCards(data).length, 251);
  assert.equal(data.filter(c => c.kind === 'reading').length, 213);
  assert.equal(data.filter(c => c.kind === 'listening').length, 38);
  assert.ok(data.every(c => c.translation && c.originalRef && c.note && c.sentence.includes(c.focus)));
  assert.ok(data.find(c => c.id === 'c17-t1-p1-005').sentence.includes('resulted in'));
  assert.ok(data.find(c => c.id === 'c17-t1-p1-087').originalRef.includes('原题'));
  assert.ok(data.find(c => c.id === 'c17-t1-p2-124').sentence.includes('incorporated into'));
});
test('first good schedules 1 day, easy skips to 3 days', () => {
  assert.equal(schedule(null, 'good', now).due, now + DAY);
  assert.equal(schedule(null, 'easy', now).due, now + 3 * DAY);
});
test('success follows transparent staircase and caps at 120 days', () => {
  let p;
  for (const n of [1, 3, 7, 14, 30, 60, 120, 120]) { p = schedule(p, 'good', now); assert.equal(p.due, now + n * DAY); }
});
test('forgetting resets learning and keeps true lapse count', () => {
  const p = schedule(schedule(null, 'good', now), 'again', now);
  assert.equal(p.due, now + 600000); assert.equal(p.stage, -1); assert.equal(p.lapses, 1);
  assert.equal(schedule(p, 'good', now).due, now + DAY);
  assert.equal(schedule(p, 'again', now).lapses, 2);
});
test('hard halves current interval with a one-day minimum', () => {
  assert.equal(schedule(null, 'hard', now).due, now + DAY);
  assert.equal(schedule({ stage: 3, reps: 3, lapses: 0 }, 'hard', now).due, now + 7 * DAY);
});
test('invalid ratings fail', () => assert.throws(() => schedule(null, 'invalid', now)));
test('initial queue interleaves sources without invented history', () => {
  const state = emptyState(), q = queueFor(data, state, now);
  assert.equal(q.length, 5); assert.equal(q[0].kind, 'reading'); assert.equal(q[2].kind, 'listening');
  assert.equal(Object.keys(state.progress).length, 0);
});
test('due cards precede fresh cards even with daily new allowance exhausted', () => {
  const state = emptyState(); state.settings.dailyNew = 0;
  state.progress[data[7].id] = { ...schedule(null, 'good', now), due: now - 1000 };
  state.progress[data[2].id] = { ...schedule(null, 'good', now), due: now - 2000 };
  assert.deepEqual(queueFor(data, state, now).map(c => c.id), [data[2].id, data[7].id]);
});
test('new limit counts distinct first ratings today, not repetitions', () => {
  const state = emptyState(); state.settings.dailyNew = 2;
  state.progress[data[0].id] = schedule(null, 'again', now);
  state.events = [{ cardId: data[0].id, day: dayKey(now), isNew: true }, { cardId: data[0].id, day: dayKey(now), isNew: true }];
  assert.equal(queueFor(data, state, now).length, 1);
  assert.equal(queueFor(data, state, now + DAY).filter(c => !state.progress[c.id]).length, 2);
});
test('Shanghai day boundary and punctuation-tolerant answer comparison', () => {
  assert.equal(dayKey(Date.parse('2026-11-21T16:01:00Z')), '2026-11-22');
  assert.ok(checkAnswer('The CITY’s streets.', "the city's streets"));
  assert.ok(!checkAnswer('depot', 'salt'));
});
test('full backups validate and merge later progress without resetting it', () => {
  const current = emptyState(), incoming = emptyState();
  current.cards = [data[0]]; incoming.cards = [data[1]];
  current.progress[data[0].id] = schedule(null, 'easy', now);
  incoming.progress[data[0].id] = schedule(null, 'again', now - 1000);
  incoming.favorites = [data[1].id];
  const merged = mergeBackup(current, incoming);
  assert.equal(merged.cards.length, 2);
  assert.equal(merged.progress[data[0].id].due, now + 3 * DAY);
  assert.deepEqual(merged.favorites, [data[1].id]);
  assert.equal(validateBackup(merged).schemaVersion, 1);
});
test('imports reject malformed, future-schema and malicious records before writing', () => {
  assert.throws(() => validateCards([data[0], data[0]]));
  assert.throws(() => validateCards([{ ...data[0], focus: 'not in the original' }]));
  assert.throws(() => validateCards([{ ...data[0], id: '__proto__' }]));
  assert.throws(() => validateCards([{ ...data[0], note: {} }]));
  assert.throws(() => validateBackup({ ...emptyState(), schemaVersion: 2 }));
  assert.throws(() => validateBackup({ ...emptyState(), progress: { x: { stage: 0, due: -1 } } }));
});
