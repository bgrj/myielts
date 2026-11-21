export const VERSION = 1;
export const DAY = 86400000;
export const STEPS = [1, 3, 7, 14, 30, 60, 120];
export function dayKey(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function emptyState() {
  return { schemaVersion: VERSION, cards: [], progress: {}, favorites: [], events: [], settings: { dailyNew: 5, rate: 0.85 }, updatedAt: 0 };
}
export function schedule(previous, rating, now = Date.now()) {
  if (!['again', 'hard', 'good', 'easy'].includes(rating)) throw new Error('无效评分');
  const old = previous || { stage: -1, reps: 0, lapses: 0 };
  let stage = old.stage;
  let interval;
  if (rating === 'again') { stage = -1; interval = 10 * 60000; }
  else if (rating === 'hard') { stage = Math.max(0, stage); interval = Math.max(1, STEPS[stage] / 2) * DAY; }
  else { stage = Math.min(STEPS.length - 1, stage + (rating === 'easy' ? 2 : 1)); interval = STEPS[stage] * DAY; }
  return { stage, due: now + interval, reps: old.reps + 1, lapses: old.lapses + (rating === 'again' ? 1 : 0), lastReviewed: now };
}
export function queueFor(cards, state, now = Date.now(), kind = 'all') {
  const due = cards.filter(c => (kind === 'all' || c.kind === kind) && state.progress[c.id]?.due <= now)
    .sort((a, b) => state.progress[a.id].due - state.progress[b.id].due);
  const started = new Set(state.events.filter(e => e.day === dayKey(now) && e.isNew).map(e => e.cardId)).size;
  const allowance = Math.max(0, state.settings.dailyNew - started);
  const fresh = cards.filter(c => !state.progress[c.id] && (kind === 'all' || c.kind === kind));
  // Interleave sources: a day's new cards need not all come from one passage.
  const groups = new Map();
  for (const c of fresh) { if (!groups.has(c.source)) groups.set(c.source, []); groups.get(c.source).push(c); }
  const interleaved = [];
  while ([...groups.values()].some(g => g.length)) for (const g of groups.values()) if (g.length) interleaved.push(g.shift());
  return [...due, ...interleaved.slice(0, allowance)];
}
export function normalizeAnswer(s) {
  return s.normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}'-]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
export function checkAnswer(typed, expected) { return normalizeAnswer(typed) === normalizeAnswer(expected); }
const plain = x => x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const validId = x => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(x) && !['constructor', 'prototype', '__proto__'].includes(x);
export function validateCards(cards) {
  if (!Array.isArray(cards) || cards.length > 10000) throw new Error('cards 必须是最多 10,000 条的数组');
  const seen = new Set();
  return cards.map((card, index) => {
    const prefix = `第 ${index + 1} 条：`;
    if (!plain(card) || !validId(card.id) || seen.has(card.id)) throw new Error(prefix + 'id 无效或重复');
    seen.add(card.id);
    if (!['reading', 'listening'].includes(card.kind)) throw new Error(prefix + 'kind 需为 reading 或 listening');
    for (const key of ['target', 'sentence', 'focus', 'source']) if (typeof card[key] !== 'string' || !card[key].trim()) throw new Error(prefix + `缺少 ${key}`);
    if (!card.sentence.toLowerCase().includes(card.focus.toLowerCase())) throw new Error(prefix + 'focus 必须出现在原句中');
    const result = { id: card.id, kind: card.kind };
    for (const key of ['target', 'meaning', 'sentence', 'focus', 'source', 'title', 'translation', 'ipa', 'note', 'collocations', 'related', 'etymology', 'personalError', 'originalRef', 'origin']) {
      const value = card[key] ?? '';
      if (typeof value !== 'string' || value.length > 12000) throw new Error(prefix + `${key} 需为不超过 12,000 字的文本`);
      result[key] = value.trim();
    }
    if (!result.meaning && !result.translation && !result.note) throw new Error(prefix + '需提供中文释义、翻译或难点解释');
    result.tags = Array.isArray(card.tags) ? card.tags.filter(x => typeof x === 'string').slice(0, 10).map(x => x.slice(0, 30)) : [];
    result.fragment = card.fragment === true;
    return result;
  });
}
export function validateBackup(data) {
  if (!plain(data) || data.schemaVersion !== VERSION) throw new Error('备份版本不受支持，需要 schemaVersion: 1');
  const result = emptyState();
  result.cards = validateCards(data.cards);
  const number = (x, min, max) => Number.isFinite(x) && x >= min && x <= max;
  if (!plain(data.progress)) throw new Error('备份缺少有效 progress');
  for (const [id, p] of Object.entries(data.progress)) {
    if (!validId(id) || !plain(p) || !Number.isInteger(p.stage) || !number(p.stage, -1, 6) || !number(p.due, 0, 1e14) || !number(p.lastReviewed, 0, 1e14) || !Number.isInteger(p.reps) || !number(p.reps, 1, 1e8) || !Number.isInteger(p.lapses) || !number(p.lapses, 0, p.reps)) throw new Error('备份中有无效复习进度');
    result.progress[id] = { stage: p.stage, due: p.due, lastReviewed: p.lastReviewed, reps: p.reps, lapses: p.lapses };
  }
  if (!Array.isArray(data.events) || data.events.length > 200000) throw new Error('备份的学习记录无效或过大');
  for (const e of data.events) {
    if (!plain(e) || !validId(e.id) || !validId(e.cardId) || !number(e.at, 0, 1e14) || e.day !== dayKey(e.at) || !['again', 'hard', 'good', 'easy'].includes(e.rating) || typeof e.isNew !== 'boolean') throw new Error('备份中有无效学习记录');
    result.events.push({ id: e.id, cardId: e.cardId, at: e.at, day: e.day, rating: e.rating, isNew: e.isNew });
  }
  if (!Array.isArray(data.favorites) || data.favorites.some(x => !validId(x))) throw new Error('备份收藏列表无效');
  result.favorites = [...new Set(data.favorites)];
  if (!plain(data.settings) || !Number.isInteger(data.settings.dailyNew) || !number(data.settings.dailyNew, 0, 30) || !number(data.settings.rate, 0.5, 1.2)) throw new Error('设置无效');
  result.settings = { dailyNew: data.settings.dailyNew, rate: data.settings.rate };
  result.updatedAt = number(data.updatedAt, 0, 1e14) ? data.updatedAt : 0;
  return result;
}
export function mergeBackup(current, incoming) {
  const other = validateBackup(incoming);
  const out = structuredClone(current);
  const newIsLatest = other.updatedAt >= current.updatedAt;
  const cardMap = new Map((newIsLatest ? [...current.cards, ...other.cards] : [...other.cards, ...current.cards]).map(c => [c.id, c]));
  out.cards = [...cardMap.values()];
  for (const [id, p] of Object.entries(other.progress)) if (!out.progress[id] || p.lastReviewed > out.progress[id].lastReviewed) out.progress[id] = p;
  out.events = [...new Map([...current.events, ...other.events].map(e => [e.id, e])).values()].sort((a, b) => a.at - b.at);
  out.favorites = [...new Set([...current.favorites, ...other.favorites])];
  if (newIsLatest) out.settings = other.settings;
  out.updatedAt = Math.max(current.updatedAt, other.updatedAt);
  return out;
}
