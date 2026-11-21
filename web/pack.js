import { validateCards } from './core.js';

const KEYS = new Map([
  ['类型', 'kind'], ['kind', 'kind'],
  ['出处', 'source'], ['来源', 'source'], ['source', 'source'],
  ['篇名', 'title'], ['标题', 'title'], ['场景', 'title'], ['title', 'title'],
  ['原句', 'sentence'], ['句子', 'sentence'], ['sentence', 'sentence'],
  ['考点', 'focus'], ['focus', 'focus'],
  ['知识点', 'target'], ['表达', 'target'], ['target', 'target'],
  ['释义', 'meaning'], ['含义', 'meaning'], ['meaning', 'meaning'],
  ['翻译', 'translation'], ['译文', 'translation'], ['translation', 'translation'],
  ['错因', 'personalError'], ['错题', 'personalError'], ['我的答案', 'personalError'],
  ['反馈', 'feedback'], ['feedback', 'feedback'],
  ['讲解', 'note'], ['笔记', 'note'], ['解释', 'note'], ['note', 'note'],
  ['音标', 'ipa'], ['ipa', 'ipa'],
  ['搭配', 'collocations'], ['collocations', 'collocations'],
  ['说话人', 'speaker'], ['speaker', 'speaker'],
  ['音频', 'audioName'], ['录音', 'audioName'], ['audio', 'audioName'], ['audioName', 'audioName'],
  ['开始', 'audioStart'], ['start', 'audioStart'], ['audioStart', 'audioStart'],
  ['结束', 'audioEnd'], ['end', 'audioEnd'], ['audioEnd', 'audioEnd'],
  ['id', 'id'],
]);

export const EXAMPLE_PACK = `# 阅读
出处: 剑雅 18 · Test 2 · Passage 1
篇名: 自己的篇章名
原句: The city became increasingly congested.
考点: congested
释义: 拥挤的
翻译: 这座城市变得越来越拥挤。
错因: 把 congested 看成了 congest
讲解: become increasingly 后面接形容词，表示越来越……

---

# 听力
出处: 剑雅 15 · Test 1 · Section 2
篇名: 自己的场景名
原句: I'd like to book a single room for two nights.
考点: book a single room
释义: 预订一间单人房
翻译: 我想预订一间单人房，住两晚。
错因: book 听成了 look
讲解: book 在句中常弱读，注意和 look 区分
音频: section2.mp3
开始: 64
结束: 71
`;

function stableId(kind, source, sentence, focus) {
  const s = [kind, source, sentence, focus].join('\u0000').normalize('NFKC');
  let h1 = 2166136261;
  let h2 = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
    h2 ^= s.charCodeAt(s.length - 1 - i);
    h2 = Math.imul(h2, 16777619);
  }
  return `mine-${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function kindOf(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['reading', '阅读', '读'].includes(text)) return 'reading';
  if (['listening', '听力', '听'].includes(text)) return 'listening';
  return '';
}

function prepareCard(card, index) {
  const prefix = `第 ${index + 1} 条：`;
  const c = { ...card };
  c.kind = kindOf(c.kind) || (c.kind ? '' : 'reading');
  if (!c.kind) throw new Error(prefix + '类型请写阅读或听力');
  c.sentence = String(c.sentence || '').trim();
  c.source = String(c.source || '').trim();
  if (!c.sentence || !c.source) throw new Error(prefix + '需要「原句」和「出处」');
  if (!String(c.focus || '').trim()) c.focus = c.sentence;
  if (!String(c.target || '').trim()) c.target = String(c.focus).trim();
  c.focus = String(c.focus).trim();
  c.target = String(c.target).trim();
  if (!c.id) c.id = stableId(c.kind, c.source, c.sentence, c.focus);
  if (!c.origin) c.origin = '我的导入';
  if (!c.originalRef) c.originalRef = c.source;
  if (c.kind === 'listening' && !c.lessonId) c.selfStudy = true;
  if (!Array.isArray(c.tags) || !c.tags.length) c.tags = ['我的资料'];
  const rawAudio = String(c.audioName || '').trim();
  const times = clipTimes(c, index);
  if (/^https:\/\//i.test(rawAudio)) {
    if (!times) throw new Error(prefix + '网络音频需要「开始」和「结束」，单位是秒');
    c.audio = { url: rawAudio, start: times.start, end: times.end };
    delete c.audioName; delete c.audioStart; delete c.audioEnd;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(rawAudio)) {
    throw new Error(prefix + '网络音频只接受 HTTPS 链接，并要写开始和结束（秒）');
  } else if (rawAudio) {
    c.audioName = rawAudio.split(/[/\\]/).pop();
    if (times) { c.audioStart = times.start; c.audioEnd = times.end; }
    else { delete c.audioStart; delete c.audioEnd; }
  } else {
    delete c.audioName;
    if (!times) { delete c.audioStart; delete c.audioEnd; }
    else if (!c.audio) throw new Error(prefix + '写了开始或结束时，需要「音频: 文件名」或 HTTPS 链接');
  }
  return c;
}

function clipTimes(card, index) {
  const prefix = `第 ${index + 1} 条：`;
  const startBlank = card.audioStart == null || card.audioStart === '';
  const endBlank = card.audioEnd == null || card.audioEnd === '';
  if (startBlank && endBlank) return null;
  if (startBlank || endBlank) throw new Error(prefix + '开始和结束要成对填写，单位是秒；播放整段就两个都留空');
  const start = Number(card.audioStart), end = Number(card.audioEnd);
  if (!Number.isFinite(start) || start < 0 || !Number.isFinite(end) || end <= start || end - start > 300) throw new Error(prefix + '音频片段需在 0–300 秒内。更长的录音请不要填开始和结束，播放时用整段。');
  return { start, end };
}

function parseBlocks(text) {
  const blocks = text.split(/^\s*---\s*$/m).map(block => block.trim()).filter(Boolean);
  if (!blocks.length) throw new Error('没有可导入的内容');
  return blocks.map((block, index) => {
    const card = {};
    let field = '';
    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const heading = line.match(/^#{1,3}\s*(阅读|听力|reading|listening)\s*$/i);
      if (heading) { card.kind = heading[1]; field = ''; continue; }
      const pair = line.match(/^([^:：]{1,12})[:：]\s*(.*)$/);
      const key = pair ? KEYS.get(pair[1].trim()) : '';
      if (key) { card[key] = pair[2]; field = key; continue; }
      if (field) card[field] = `${card[field]}\n${line}`;
      else throw new Error(`第 ${index + 1} 条：「${line.slice(0, 24)}」无法识别。每条需要「出处:」和「原句:」，条目之间用单独一行 --- 分开。`);
    }
    return prepareCard(card, index);
  });
}

function unwrap(text) {
  return text.replace(/^\uFEFF/, '').trim().replace(/^```(?:json|text)?\s*/i, '').replace(/\s*```$/, '').trim();
}

export function parseStudyPack(input) {
  if (input && typeof input === 'object') return normalizeRecords(input);
  const text = unwrap(String(input ?? ''));
  if (!text) throw new Error('没有可导入的内容');
  if (text.startsWith('{') || text.startsWith('[')) {
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('JSON 格式不正确，请只粘贴 JSON，不含代码围栏。也可以改用「出处 / 原句」文本格式。'); }
    return normalizeRecords(data);
  }
  return validateCards(parseBlocks(text));
}

function normalizeRecords(data) {
  const list = Array.isArray(data) ? data : data?.cards;
  if (!Array.isArray(list)) throw new Error('需要 cards 数组，或用「出处 / 原句」分行书写');
  if (data && !Array.isArray(data) && data.schemaVersion !== undefined && data.schemaVersion !== 1) throw new Error('需要 schemaVersion: 1 的知识卡 JSON');
  return validateCards(list.map((card, index) => prepareCard(card, index)));
}
