import { cloneData } from './compat.js';
export const VERSION = 1;
export const DAY = 86400000;
export const STEPS = [1, 3, 7, 14, 30, 60, 120];
export function dayKey(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function emptyState() {
  return { schemaVersion: VERSION, cards: [], librarySnapshot: [], progress: {}, favorites: [], events: [], settings: { dailyNew: 5, rate: 1, language: 'zh', theme: 'light', studyScope: 'all', textSize: 'md' }, updatedAt: 0 };
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
  const ready = cards.filter(c => c.kind !== 'listening' || c.audio || c.selfStudy);
  const due = ready.filter(c => (kind === 'all' || c.kind === kind) && state.progress[c.id]?.due <= now)
    .sort((a, b) => state.progress[a.id].due - state.progress[b.id].due);
  const started = new Set(state.events.filter(e => e.day === dayKey(now) && e.isNew).map(e => e.cardId)).size;
  const allowance = Math.max(0, state.settings.dailyNew - started);
  const wants = c => kind === 'listening' ? c.kind === 'listening' : kind === 'reading' ? c.kind === 'reading' : (c.kind === 'reading' || (c.kind === 'listening' && c.selfStudy));
  const fresh = ready.filter(c => !state.progress[c.id] && wants(c) && (kind === 'all' || c.kind === kind));
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
    for (const key of ['target', 'meaning', 'sentence', 'focus', 'source', 'title', 'translation', 'ipa', 'note', 'collocations', 'related', 'etymology', 'personalError', 'originalRef', 'origin', 'feedback', 'speaker', 'pronunciation', 'grammar', 'audioSource', 'sectionGroup', 'sourceTurn', 'translationContext']) {
      const value = card[key] ?? '';
      if (typeof value !== 'string' || value.length > 12000) throw new Error(prefix + `${key} 需为不超过 12,000 字的文本`);
      result[key] = value.trim();
    }
    result.tags = Array.isArray(card.tags) ? card.tags.filter(x => typeof x === 'string').slice(0, 10).map(x => x.slice(0, 30)) : [];
    result.fragment = card.fragment === true;
    result.sourceVerified = card.sourceVerified === true;
    result.selfStudy = card.selfStudy === true;
    if (card.lessonId !== undefined) {
      if (card.kind !== 'listening' || !validId(card.lessonId) || !Number.isInteger(card.order) || card.order < 1 || card.order > 2000) throw new Error(prefix + '听力课程编号或句序无效');
      result.lessonId = card.lessonId; result.order = card.order;
    }
    if (card.audio != null) {
      if (!plain(card.audio) || typeof card.audio.url !== 'string' || card.audio.url.length > 2000) throw new Error(prefix + '原音信息无效');
      let url; try { url = new URL(card.audio.url); } catch { throw new Error(prefix + '原音 URL 无效'); }
      const loopbackPreview = typeof location !== 'undefined' && url.protocol === 'http:' && url.origin === location.origin && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if ((url.protocol !== 'https:' && !loopbackPreview) || url.username || url.password) throw new Error(prefix + '原音需为无凭据的 HTTPS 链接');
      const { start = 0, end } = card.audio;
      if (!Number.isFinite(start) || start < 0 || !Number.isFinite(end) || end <= start || end - start > 300) throw new Error(prefix + '原音片段需为 0–300 秒的有效时间范围');
      result.audio = { url: url.href, start, end };
    }
    if (card.audioName != null && card.audioName !== '') {
      if (typeof card.audioName !== 'string' || !card.audioName.trim() || card.audioName.trim().length > 180 || /[\\/]/.test(card.audioName) || card.audioName.includes('..') || /^[a-z][a-z0-9+.-]*:/i.test(card.audioName)) throw new Error(prefix + '音频文件名无效');
      result.audioName = card.audioName.trim();
    }
    const startBlank = card.audioStart == null || card.audioStart === '';
    const endBlank = card.audioEnd == null || card.audioEnd === '';
    if (!startBlank || !endBlank) {
      const start = Number(card.audioStart), end = Number(card.audioEnd);
      if (startBlank || endBlank || !Number.isFinite(start) || start < 0 || !Number.isFinite(end) || end <= start || end - start > 300) throw new Error(prefix + '音频片段需成对填写，且在 0–300 秒内；整段播放请不要填开始和结束');
      result.audioStart = start;
      result.audioEnd = end;
    }
    if (card.localAudio != null) {
      if (!plain(card.localAudio) || !validId(card.localAudio.id)) throw new Error(prefix + '本地音频无效');
      result.localAudio = { id: card.localAudio.id };
    }
    return result;
  });
}
export function validateBackup(data) {
  if (!plain(data) || data.schemaVersion !== VERSION) throw new Error('备份版本不受支持，需要 schemaVersion: 1');
  const result = emptyState();
  result.cards = validateCards(data.cards);
  result.librarySnapshot = validateCards(data.librarySnapshot || []);
  if (data.localCardIds !== undefined) {
    if (!Array.isArray(data.localCardIds) || data.localCardIds.some(id => !validId(id) || !result.cards.some(c => c.id === id))) throw new Error('备份中的个人编辑标记无效');
    const local = new Set(data.localCardIds);
    result.librarySnapshot = [...new Map([...result.librarySnapshot, ...result.cards.filter(c => !local.has(c.id))].map(c => [c.id, c])).values()];
    result.cards = result.cards.filter(c => local.has(c.id));
  }
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
  const language = data.settings.language === undefined ? 'zh' : data.settings.language;
  const theme = data.settings.theme === undefined ? 'light' : data.settings.theme;
  const studyScope = data.settings.studyScope === undefined ? 'all' : data.settings.studyScope;
  const textSize = data.settings.textSize === undefined ? 'md' : data.settings.textSize;
  if (!['zh', 'en'].includes(language) || !['light', 'dark'].includes(theme) || !['all', 'mine', 'builtin'].includes(studyScope) || !['sm', 'md', 'lg', 'xl'].includes(textSize)) throw new Error('设置无效');
  result.settings = { dailyNew: data.settings.dailyNew, rate: data.settings.rate, language, theme, studyScope, textSize };
  result.updatedAt = number(data.updatedAt, 0, 1e14) ? data.updatedAt : 0;
  return result;
}
export function mergeBackup(current, incoming) {
  const other = validateBackup(incoming);
  const out = cloneData(current);
  const newIsLatest = other.updatedAt >= current.updatedAt;
  const cardMap = new Map((newIsLatest ? [...current.cards, ...other.cards] : [...other.cards, ...current.cards]).map(c => [c.id, c]));
  out.cards = [...cardMap.values()];
  out.librarySnapshot = [...new Map((newIsLatest ? [...(current.librarySnapshot || []), ...other.librarySnapshot] : [...other.librarySnapshot, ...(current.librarySnapshot || [])]).map(c => [c.id, c])).values()];
  for (const [id, p] of Object.entries(other.progress)) if (!out.progress[id] || p.lastReviewed > out.progress[id].lastReviewed) out.progress[id] = p;
  out.events = [...new Map([...current.events, ...other.events].map(e => [e.id, e])).values()].sort((a, b) => a.at - b.at);
  out.favorites = [...new Set([...current.favorites, ...other.favorites])];
  if (newIsLatest) out.settings = other.settings;
  out.updatedAt = Math.max(current.updatedAt, other.updatedAt);
  return out;
}
