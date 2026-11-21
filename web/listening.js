export const INITIAL_LESSONS = ['self-drive', 'leisure-club'];

export function lessonCards(cards, lessonId) {
  return cards.filter(c => c.kind === 'listening' && c.lessonId === lessonId && c.audio).sort((a, b) => a.order - b.order);
}

export function lessonQueue(cards, state, lessonId, mode = 'continue', now = Date.now()) {
  const ordered = lessonCards(cards, lessonId);
  if (mode === 'review') return ordered.filter(c => state.progress[c.id]?.due <= now);
  if (mode === 'restart') return ordered;
  return ordered.filter(c => !state.progress[c.id]);
}

export function validateLessons(lessons, cards) {
  if (!Array.isArray(lessons) || lessons.length < 2 || lessons.length > 100) throw new Error('听力发布必须保留完整课程清单');
  const ids = new Set();
  const clean = lessons.map(l => {
    if (!l || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(l.id) || ids.has(l.id)) throw new Error('听力课程 id 无效或重复');
    ids.add(l.id);
    if (!['title', 'source'].every(k => typeof l[k] === 'string' && l[k].trim() && l[k].length <= 300)) throw new Error('课程标题或出处缺失');
    if (!INITIAL_LESSONS.includes(l.id) && (l.release !== 'user-request' || typeof l.releaseNote !== 'string' || !l.releaseNote.trim())) throw new Error('新增第三部分及后续场景必须记录用户明确要求');
    const group = cards.filter(c => c.lessonId === l.id).sort((a,b) => a.order-b.order);
    if (!Number.isInteger(l.sentenceCount) || group.length !== l.sentenceCount || !group.length || group.some((c,i) => c.order !== i+1)) throw new Error('课程须包含连续、完整的原声句序');
    if (l.announcerCount !== group.filter(c => c.speaker === 'ANNOUNCER').length || l.announcerCount < 1) throw new Error('课程必须包含播音员原声句子');
    return { id:l.id, title:l.title, source:l.source, sentenceCount:l.sentenceCount, announcerCount:l.announcerCount, release:l.release || 'initial', releaseNote:l.releaseNote || '' };
  });
  if (INITIAL_LESSONS.some(id => !ids.has(id)) || cards.some(c => !ids.has(c.lessonId))) throw new Error('课程清单与原句不匹配，须保留自驾游和健身俱乐部');
  return clean;
}
