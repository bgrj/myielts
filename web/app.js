import { DAY, dayKey, emptyState, schedule, queueFor, checkAnswer, validateCards, validateBackup, mergeBackup } from './core.js';
import { PUBLISHERS, LEARNING_URL, publishedCards, botInstructions, validateFeed } from './publishing.js';
import { FeedClient } from './feed-client.js';
import { lessonCards, lessonQueue, findLessonSentences } from './listening.js';
import { cloneData, uniqueId, installDialogFallback, timeoutRequest } from './compat.js';
import { setLanguage, t, localizeText } from './i18n.js';
import { EXAMPLE_PACK, parseStudyPack } from './pack.js';
import { clipForName, clipObjectUrl, exportClips, loadClipIndex, restoreClips, saveClip } from './audio-store.js';
installDialogFallback();

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paths = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  book: '<path d="M12 6c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1zm0 0v15"/>',
  practice: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 3h6v3H9zm-1 9 2 2 5-5m-7 9h8"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  external: '<path d="M14 3h7v7m0-7-9 9M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
  speaker: '<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  star: '<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2L2.9 9.6l6.3-.9z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  leaf: '<path d="M20 3C8 2 2 9 6 16s15 3 14-13ZM5 20l11-11"/>',
  edit: '<path d="m16 3 5 5-12 12H4v-5zm-2 2 5 5M3 22h19"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  chat: '<path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>',
  heart: '<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`; }
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const STORAGE = 'myielts.state.v1';
let state = emptyState(), baseCards = [], session = null, lastRating = null, route = 'today';
let filters = { kind: 'all', source: '', search: '', favorite: false, limit: 30 };
let canStore = true, rawRecovery = null, audioURL = null, toastTimer, swRegistration, applyUpdate = false;
let publishedFeeds = {}, pendingFeeds = null, feedClient, feedFailures = {};
let originalPlayer = null, originalRepeatTimer = null;
let readingSpeech = new Map(), resumeAudio = null;
let pointerBusy = false;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200); }
function storageWarning(message) { const el = $('#storage-warning'); el.hidden = false; el.textContent = message; }
function applyAppearance() {
  const theme = state.settings.theme === 'dark' ? 'dark' : 'light';
  const english = state.settings.language === 'en';
  const textSize = ['sm', 'md', 'lg', 'xl'].includes(state.settings.textSize) ? state.settings.textSize : 'md';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.text = textSize;
  document.documentElement.lang = english ? 'en' : 'zh-CN';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#101816' : '#153f35';
  setLanguage(english ? 'en' : 'zh');
}
function applyChrome() {
  applyAppearance();
  document.title = t('MyIELTS · 每一句，都记住一点', 'MyIELTS · Remember each sentence');
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = t('你的剑雅原句学习本。回到语境，在阅读与精听中练习，用间隔复习慢慢记牢。', 'Your Cambridge IELTS notebook. Return to the original sentence, practise, and remember it with spaced review.');
  const text = {
    skip: t('跳到学习内容', 'Skip to study'),
    caption: t('我的剑雅学习本', 'My Cambridge notebook'),
    'nav-today': t('今日学习', 'Today'),
    'nav-practice': t('随手练习', 'Practice'),
    'nav-library': t('我的知识库', 'Library'),
    'nav-settings': t('资料与设置', 'Settings'),
    'footer-right': 'MyIELTS',
    'close-player': t('关闭', 'Close'),
    resume: t('继续播放', 'Resume'),
    'open-audio': t('单独打开音频', 'Open audio'),
    loading: t('正在打开你的学习本…', 'Opening your notebook…'),
    'feedback-label': t('意见', 'Ideas'),
    'support-label': t('支持', 'Support'),
    'support-heading': t('支持 Our beings', 'Support Our beings'),
    'support-lead': t('和主站同一处。选一个你方便的渠道即可。', 'The same channels as the main site. Use whichever is convenient.'),
    'feedback-heading': t('优化改善意见收集箱', 'Ideas for improving MyIELTS'),
    'feedback-lead': t('这个工具哪里不顺手，扫码进微信群说一声。', 'If something feels awkward, scan the code and tell us in the WeChat group.'),
    'feedback-note': t('群名：Mi 优化改善意见收集箱。群码有效期至 11 月 29 日，进群后会更新。', 'Group: Mi 优化改善意见收集箱. The code is valid until 29 Nov and refreshes after you join.'),
  };
  for (const [key, value] of Object.entries(text)) {
    const el = document.querySelector(`[data-ui="${key}"]`);
    if (el) el.textContent = value;
  }
  const aria = {
    brand: t('MyIELTS 首页', 'MyIELTS home'),
    support: t('支持这个学习本', 'Support this notebook'),
    'support-close': t('关闭支持', 'Close support'),
    feedback: t('意见收集箱', 'Feedback group'),
    'feedback-close': t('关闭意见收集箱', 'Close feedback'),
    'audio-dock': t('音频播放器', 'Audio player'),
    'close-player': t('关闭播放器', 'Close player'),
    'shared-audio': t('学习音频播放器', 'Study audio player'),
    nav: t('主要导航', 'Main navigation'),
  };
  for (const [key, value] of Object.entries(aria)) {
    const el = document.querySelector(`[data-ui-aria="${key}"]`);
    if (!el) continue;
    el.setAttribute('aria-label', value);
    if (key === 'support' || key === 'feedback') el.title = value;
  }
  if ($('#audio-dock')?.hidden && $('#audio-title')) $('#audio-title').textContent = t('音频播放', 'Audio');
  const feedbackQr = $('#feedback-qr');
  if (feedbackQr) feedbackQr.alt = t('微信群二维码：Mi 优化改善意见收集箱', 'WeChat group QR code for MyIELTS feedback');
  if ($('#today-date')) $('#today-date').textContent = new Intl.DateTimeFormat(state.settings.language === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(Date.now());
}
function persist() {
  state.updatedAt = Date.now();
  if (!canStore) return;
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
  catch { canStore = false; storageWarning(t('此浏览器暂时无法保存进度。当前会话可以继续，请在「资料与设置」导出备份。', 'This browser cannot save progress right now. You can keep studying this session. Export a backup from Settings.')); }
}
function isMine(c) { return c.origin === '我的导入' || c.origin === '手动录入' || /^(mine|custom)-/.test(c.id); }
function allCards() { return publishedCards([...baseCards, ...state.librarySnapshot], publishedFeeds, state.cards); }
function cards() {
  const all = allCards();
  const scope = state.settings.studyScope || 'all';
  if (scope === 'mine') return all.filter(isMine);
  if (scope === 'builtin') return all.filter(c => !isMine(c));
  return all;
}
function canApplyFeed() {
  return !pointerBusy && !session && !document.querySelector('dialog[open]') && !document.activeElement?.matches('input,textarea,select') && !(route === 'settings' && $('#import-json')?.value.trim());
}
function applyPendingFeed() {
  if (!pendingFeeds || !canApplyFeed()) return;
  publishedFeeds = pendingFeeds; pendingFeeds = null;
  if (route === 'settings' || route === 'practice') updateFeedStatus(); else render();
}
function receiveFeed({ feeds, changed, failures }) {
  feedFailures = failures;
  if (changed) {
    pendingFeeds = feeds;
    const hasNotes = Object.values(feeds).some(feed => feed.cards.length);
    if (canApplyFeed()) { publishedFeeds = feeds; pendingFeeds = null; if (route === 'settings' || route === 'practice') updateFeedStatus(); else render(); if (hasNotes) toast(t('已收到更新的学习内容，复习进度已保留。', 'Updated study material is in. Your review progress is unchanged.')); }
    else if (hasNotes) toast(t('已收到学习内容更新，结束本轮学习或编辑后显示。', 'An update arrived. It will show after this round or when you finish editing.'));
  }
  updateFeedStatus();
}
async function refreshPublished(manual = false) {
  if (!feedClient || (!navigator.onLine && !manual)) return;
  const button = $('[data-action="sync-content"]'); if (button) button.disabled = true;
  const result = await feedClient.refresh();
  refreshReadingSpeech(true);
  const currentButton = $('[data-action="sync-content"]'); if (currentButton) currentButton.disabled = false;
  if (manual) toast(Object.keys(result.failures).length ? t('部分内容源暂不可用，已有知识和进度仍保留。', 'Part of the content source is unavailable. Saved cards and progress remain.') : pendingFeeds ? t('已收到更新，结束本轮学习或编辑后显示。', 'An update arrived. It will show after this round or when you finish editing.') : t('已检查最新学习内容。', 'Checked for the latest study material.'));
}
function updateFeedStatus() {
  for (const kind of Object.keys(PUBLISHERS)) {
    const el = $(`[data-feed-status="${kind}"]`); if (!el) continue;
    const feed = feedClient?.feeds[kind];
    if (feedFailures[kind]) el.textContent = feed ? t('暂未连上最新内容，使用已保存版本。', 'Latest update is unavailable. Using the saved copy.') : t('等待连上内容源；已有知识卡可以继续学。', 'Waiting for the content source. Saved cards are still here.');
    else if (!feed) el.textContent = t('正在连接内容源…', 'Connecting…');
    else if (!feed.cards.length) el.textContent = t('发布通道已就绪 · 等待 bot 首次发布', 'Publishing is ready · waiting for the first bot update');
    else el.textContent = t(`${feed.publisher === 'grok' ? 'Bot 已发布' : '反馈资料已核对'} ${feed.cards.length} 条 · 第 ${feed.revision} 版 · ${formatDate(Date.parse(feed.updatedAt), true)}${feedClient.status[kind] === 'cached' ? ' · 离线保存' : ''}`, `${feed.publisher === 'grok' ? 'Published by the bot' : 'Feedback checked'} · ${feed.cards.length} cards · revision ${feed.revision} · ${formatDate(Date.parse(feed.updatedAt), true)}${feedClient.status[kind] === 'cached' ? ' · saved offline' : ''}`);
  }
}
function botLabel(kind) { return t(PUBLISHERS[kind].name, kind === 'reading' ? 'IELTS Reading guide' : 'IELTS Listening guide'); }
function syncPanel() {
  return `<section class="panel wide sync-panel"><h2>${t('Grok 整理', 'Grok')}</h2><p>${t('日常学习不用这一步。只有希望机器人把反馈写回站内资料时才需要。', 'Everyday study skips this. Use it only if a bot should write feedback back into the material.')}</p><div class="sync-sources">${Object.entries(PUBLISHERS).map(([kind]) => `<div><h3>${kind === 'reading' ? icon('book') : icon('headphones')} ${esc(botLabel(kind))}</h3><p class="help-text" data-feed-status="${kind}" role="status">${t('正在检查…', 'Checking…')}</p></div>`).join('')}</div><div class="import-actions"><label class="inline-choice">${t('要复制的指令', 'Instructions')}<select id="copy-kind" aria-label="${t('要复制的指令', 'Instructions')}"><option value="reading">${t('阅读 bot 配置', 'Reading bot setup')}</option><option value="listening">${t('听力 bot 配置', 'Listening bot setup')}</option><option value="prompt">${t('整理指令', 'Organising prompt')}</option></select></label><button class="btn btn-secondary" data-action="copy-chosen">${t('复制', 'Copy')}</button><button class="btn btn-secondary" data-action="sync-content">${t('检查内容更新', 'Check for updates')}</button></div></section>`;
}
function cardById(id) { return allCards().find(c => c.id === id); }
function formatDate(value, full = false) {
  return new Intl.DateTimeFormat(state.settings.language === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', ...(full ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(value);
}
function intervalText(ms) {
  if (ms < DAY) { const minutes = Math.round(ms / 60000); return t(`${minutes} 分钟`, `${minutes} min`); }
  const days = Math.round(ms / DAY * 10) / 10;
  return t(`${days} 天`, `${days} day${days === 1 ? '' : 's'}`);
}
function later(ms) { return t(`${intervalText(ms)}后`, `in ${intervalText(ms)}`); }
function badge(c) { return `<span class="badge ${c.kind}">${icon(c.kind === 'listening' ? 'headphones' : 'book')}${c.kind === 'listening' ? t('听力', 'Listening') : t('阅读', 'Reading')}</span>`; }
function favoriteButton(c) { return `<button class="icon-button favorite ${state.favorites.includes(c.id) ? 'is-favorite' : ''}" data-action="favorite" data-id="${esc(c.id)}" aria-label="${state.favorites.includes(c.id) ? t('取消收藏', 'Unsave') : t('收藏', 'Save')} ${esc(c.target)}" aria-pressed="${state.favorites.includes(c.id)}">${icon('star')}</button>`; }
function highlighted(c, blank = false) {
  const index = c.sentence.toLowerCase().indexOf(c.focus.toLowerCase());
  if (index < 0) return esc(c.sentence);
  return esc(c.sentence.slice(0, index)) + (blank ? '<span class="blank">____</span>' : `<mark>${esc(c.sentence.slice(index, index + c.focus.length))}</mark>`) + esc(c.sentence.slice(index + c.focus.length));
}
function intro(eyebrow, title, subtitle, extra = '') { return `<div class="page-intro"><div>${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}<h1>${title}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}</div>${extra}</div>`; }
function totalToday() { return new Set(state.events.filter(e => e.day === dayKey()).map(e => e.cardId)).size; }
function streak() {
  const days = new Set(state.events.map(e => e.day));
  let cursor = Date.now(), count = 0;
  if (!days.has(dayKey(cursor))) cursor -= DAY;
  while (days.has(dayKey(cursor))) { count++; cursor -= DAY; }
  return count;
}
function refreshNav() {
  const due = cards().filter(c => state.progress[c.id]?.due <= Date.now()).length;
  $('#nav-due').textContent = due;
  $('#nav-due').hidden = due === 0;
  document.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === route));
  $('#page-label').textContent = ({ today: t('今日学习', 'Today'), practice: t('随手练习', 'Practice'), library: t('我的知识库', 'Library'), settings: t('资料与设置', 'Settings') })[route];
}
function render() {
  if (pendingFeeds && canApplyFeed()) { publishedFeeds = pendingFeeds; pendingFeeds = null; }
  applyChrome();
  refreshNav();
  if (session) { renderSession(); return; }
  ({ today: renderToday, library: renderLibrary, practice: renderPractice, settings: renderSettings })[route]();
}
function renderToday() {
  const all = cards(), now = Date.now(), queue = queueFor(all, state, now);
  const due = all.filter(c => state.progress[c.id]?.due <= now).length;
  const fresh = queue.filter(c => !state.progress[c.id]).length;
  const reviewed = Object.keys(state.progress).filter(id => cardById(id)).length;
  const candidate = queue[0] || all.find(c => state.favorites.includes(c.id)) || all[0];
  const dayCounts = Array.from({ length: 7 }, (_, i) => all.filter(c => {
    const p = state.progress[c.id]; return p && (i === 0 ? p.due < now || dayKey(p.due) === dayKey(now) : dayKey(p.due) === dayKey(now + i * DAY));
  }).length);
  const max = Math.max(...dayCounts, 1);
  const sourceGroups = [...new Map(all.map(c => [c.source, { title: c.title, kind: c.kind }])).entries()];
  const todayLabel = t('今天', 'Today');
  const statusLine = queue.length
    ? t(`今天 ${due} 条到期${fresh ? ` · ${fresh} 条新内容` : ''}`, `${due} due${fresh ? ` · ${fresh} new` : ''}`)
    : reviewed ? t('今天的复习已完成', "Today's review is done") : t('从一句开始', 'Start with one sentence');
  $('#main').innerHTML = `<section class="hero hero-compact" aria-label="${t('今日复习计划', "Today's review")}"><div class="hero-copy"><h1>${t('每一句，都记住一点。', 'Remember each sentence.')}</h1><p>${statusLine}</p></div><div class="hero-actions"><button class="btn btn-lime" data-action="start-review" ${queue.length ? '' : 'disabled'}>${queue.length ? t('开始今日学习', "Start today's study") : t('目前没有待学任务', 'Nothing due right now')}</button></div></section>
    <div class="stats-grid"><div class="stat"><div class="stat-value">${totalToday()}</div><div class="stat-label">${t('今日已学', 'Today')}</div></div><div class="stat"><div class="stat-value">${streak()}</div><div class="stat-label">${t('连续天数', 'Streak')}</div></div><div class="stat"><div class="stat-value">${reviewed}<span>/ ${all.length}</span></div><div class="stat-label">${t('已开始', 'Started')}</div></div></div>
    <div class="dashboard-grid"><section><div class="section-heading"><h2>${t('今天这一句', 'This sentence')}</h2></div>${candidate ? `<article class="recommend-card"><div class="card-topline">${badge(candidate)}<span class="source-short">${esc(localizeText(candidate.source).replace('剑雅 ', ''))}</span></div><p class="english" lang="en">${highlighted(candidate)}</p><p class="meaning">${esc(candidate.meaning || candidate.translation || '')}</p><div class="card-bottom"><span class="tiny-label">${esc(candidate.target)}</span><button class="text-button dark" data-action="open-card" data-id="${esc(candidate.id)}">${t('打开', 'Open')}</button></div></article>` : `<div class="panel">${t('添加第一条，开始积累。', 'Add a first card.')}</div>`}</section>
    <section><div class="section-heading"><h2>${t('接下来 7 天', 'Next 7 days')}</h2></div><div class="week-panel"><div class="week-chart" role="img" aria-label="${esc(dayCounts.map((n, i) => `${i ? formatDate(now + i * DAY) : todayLabel} ${n}`).join(t('，', ', ')))}">${dayCounts.map((n, i) => `<div class="day-bar"><span class="bar-value">${n}</span><div class="bar-track"><div class="bar-fill" style="height:${Math.max(4, n / max * 80)}px"></div></div><span>${i ? formatDate(now + i * DAY) : todayLabel}</span></div>`).join('')}</div></div></section></div>
    <section class="source-section"><div class="section-heading"><h2>${t('出处', 'Sources')}</h2></div><div class="source-grid">${sourceGroups.map(([source, meta]) => `<button class="source-tile" data-action="source" data-source="${esc(source)}"><span class="source-book">${meta.kind === 'listening' ? icon('headphones') : '17'}</span><div><h3>${esc(localizeText(meta.title || source))}</h3><p>${all.filter(c => c.source === source).length} ${t('条', 'cards')}</p></div></button>`).join('')}</div></section>`;
}
function renderLibrary(restoreSearch = false) {
  const all = cards();
  const result = all.filter(c => (filters.kind === 'all' || c.kind === filters.kind) && (!filters.source || c.source === filters.source) && (!filters.favorite || state.favorites.includes(c.id)) && (!filters.search || [c.target, c.meaning, c.sentence, c.translation, c.note, c.source, c.originalRef].join(' ').toLowerCase().includes(filters.search.toLowerCase())));
  const kindValue = filters.favorite ? 'saved' : filters.kind;
  $('#main').innerHTML = `${intro('', t('我的知识库', 'Library'), '')}
    <div class="filter-row"><label class="search"><span class="sr-only">${t('搜索知识点或原句', 'Search a point or sentence')}</span>${icon('search')}<input id="library-search" type="search" placeholder="${t('搜单词、原句或笔记', 'Search a word, sentence or note')}" value="${esc(filters.search)}" autocomplete="off"></label><select id="kind-filter" aria-label="${t('按类型筛选', 'Filter by type')}">${[['all', t('全部', 'All')], ['reading', t('阅读', 'Reading')], ['listening', t('听力', 'Listening')], ['saved', t('收藏', 'Saved')]].map(([value, label]) => `<option value="${value}" ${kindValue === value ? 'selected' : ''}>${label}</option>`).join('')}</select><select id="source-filter" aria-label="${t('按剑雅出处筛选', 'Filter by Cambridge source')}"><option value="">${t('全部出处', 'All sources')}</option>${[...new Set(all.map(c => c.source))].map(s => `<option value="${esc(s)}" ${s === filters.source ? 'selected' : ''}>${esc(localizeText(s))}</option>`).join('')}</select></div>
    <div class="results-meta"><span>${t(`${result.length} 条`, `${result.length}`)}</span></div><div class="library-list">${result.slice(0, filters.limit).map(c => `<article class="library-card"><button class="library-open" data-action="open-card" data-id="${esc(c.id)}"><span class="row-title">${badge(c)}<strong lang="en">${esc(c.target)}</strong></span><span class="muted">${esc(c.meaning || c.translation)}</span><p lang="en">${highlighted(c)}</p><span class="library-meta">${esc(localizeText(c.source))} · ${state.progress[c.id] ? t(`下次 ${formatDate(state.progress[c.id].due, true)}`, `Next ${formatDate(state.progress[c.id].due, true)}`) : t('未开始', 'Not started')}</span></button>${favoriteButton(c)}</article>`).join('')}</div>${!result.length ? `<div class="empty-state"><h2>${all.length ? t('没有匹配的句子', 'No matching sentences') : t('还没有内容', 'Nothing yet')}</h2><p>${all.length ? t('换个词，或清除筛选。', 'Try another word, or clear the filters.') : t('到资料页粘贴原题或错题。', 'Add a sentence in Settings.')}</p>${all.length ? '' : `<p><a class="btn btn-secondary" href="#settings">${t('去导入', 'Add material')}</a></p>`}</div>` : ''}${result.length > filters.limit ? `<div class="load-more"><button class="btn btn-secondary" data-action="load-more">${t('再看 30 条', 'Show 30 more')}</button></div>` : ''}`;
  if (restoreSearch) { const input = $('#library-search'); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
}
function renderPractice() {
  const showBuiltin = (state.settings.studyScope || 'all') !== 'mine';
  $('#main').innerHTML = `${intro('', t('随手练习', 'Practice'), '')}
    ${showBuiltin ? listeningCourses() : ''}
    ${mineSection()}
    <div class="section-heading"><h2>${t('阅读小练', 'Reading practice')}</h2></div>
    <div class="practice-grid">${[
      ['cloze', 'book', t('原句填空', 'Fill the sentence'), 'reading'],
      ['recall', 'practice', t('中英回忆', 'Recall from the gloss'), 'reading'],
    ].map(([mode, ico, title, kind]) => `<button class="practice-tile" data-action="practice" data-mode="${mode}" data-kind="${kind}"><span class="stat-icon">${icon(ico)}</span><span class="practice-copy"><h2>${title}</h2><span class="text-button dark">${t('5 条', '5 cards')}</span></span></button>`).join('')}</div>
    <section class="panel local-audio-panel"><div class="local-audio-row"><div><h2>${t('本地录音', 'A local recording')}</h2><p class="help-text">${t('只在本次播放，不上传。要固定到某一句，请到资料页的「其他方式」选配套音频。', 'Plays for this visit only. Nothing is uploaded. To keep a file on a sentence, use Matching audio under Other ways in Settings.')}</p></div><label class="btn btn-secondary import-label">${t('对照整段', 'Play a whole file')}<input type="file" class="file-input" data-file="audio" accept="audio/*"></label></div>${audioElement()}</section>`;
}
const CURSOR_KEY = 'myielts.dictationCursor.v1';
let lessonSearch = '';
function readCursor(lessonId) {
  try {
    const order = JSON.parse(sessionStorage.getItem(CURSOR_KEY) || '{}')[lessonId];
    return Number.isInteger(order) && order > 0 ? order : null;
  } catch { return null; }
}
function writeCursor(lessonId, order) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CURSOR_KEY) || '{}');
    saved[lessonId] = order;
    sessionStorage.setItem(CURSOR_KEY, JSON.stringify(saved));
  } catch { /* This browser may block session storage. The sentence still changes. */ }
}
function jumpResults(list, query) {
  const matches = findLessonSentences(list, query);
  if (!String(query || '').trim()) return '';
  if (!matches.length) return `<p class="help-text">${t('没有匹配的句子', 'No matching sentence')}</p>`;
  return matches.map(c => `<button type="button" data-action="jump-lesson" data-lesson="${esc(c.lessonId)}" data-order="${c.order}"><span class="tiny-label">${esc(localizeText(c.title))} · ${t(`第 ${c.order} 句`, `Sentence ${c.order}`)} · ${esc(c.speaker)}</span><br>${esc(c.sentence)}</button>`).join('');
}
function mineSection() {
  const mine = allCards().filter(isMine);
  const sources = [...new Map(mine.map(c => [c.source, c])).entries()];
  if (!mine.length) return `<section class="panel mine-panel"><h2>${t('我的材料', 'My material')}</h2><a class="btn" href="#settings">${t('导入原题或错题', 'Add sentences')}</a></section>`;
  return `<section class="mine-panel"><div class="section-heading"><h2>${t('我的材料', 'My material')}</h2><a href="#settings">${t('继续导入', 'Add more')}</a></div><div class="source-grid">${sources.map(([source, sample]) => {
    const group = mine.filter(c => c.source === source);
    const done = group.filter(c => state.progress[c.id]).length;
    return `<article class="panel course-card"><span class="eyebrow">${sample.kind === 'listening' ? t('听力', 'Listening') : t('阅读', 'Reading')}</span><h2>${esc(localizeText(sample.title || source))}</h2><p>${group.length} ${t('条', 'cards')} · ${t(`已练 ${done}`, `done ${done}`)}</p><button class="btn" data-action="study-mine" data-source="${esc(source)}">${done ? t('继续', 'Continue') : t('开始练习', 'Start')}</button></article>`;
  }).join('')}</div></section>`;
}
function lessonGo(lessonId, done, total, due, started) {
  const finished = done === total;
  return `<div class="lesson-go"><label><span class="sr-only">${t('练习方式', 'How to practise')}</span><select aria-label="${t('练习方式', 'How to practise')}"><option value="continue" ${finished ? 'disabled' : ''}>${finished ? t('本轮已完成', 'This round is complete') : started ? t('继续逐句听写', 'Continue dictation') : t('开始逐句听写', 'Start dictation')}</option><option value="review" ${due ? '' : 'disabled'}>${t(`复习到期句${due ? ` · ${due}` : ''}`, due ? `Review due · ${due}` : 'Review due')}</option><option value="restart">${t('从头再练', 'Start over')}</option></select></label><button class="btn" data-action="lesson" data-lesson="${esc(lessonId)}">${t('开始', 'Start')}</button></div>`;
}
function listeningCourses() {
  const lessons = publishedFeeds.listening?.lessons || [];
  const searchable = lessons.flatMap(l => lessonCards(cards(), l.id));
  return `<section class="listening-courses"><div class="section-heading"><h2>${icon('headphones')} ${t('原声逐句听写', 'Sentence dictation')}</h2></div><div class="lesson-finder"><div class="dictation-nav"><label class="search"><span class="sr-only">${t('搜索原声句子', 'Search original sentences')}</span>${icon('search')}<input id="lesson-search" type="search" placeholder="${t('搜句号或原文', 'Search a number or the wording')}" value="${esc(lessonSearch)}" autocomplete="off"></label><div id="lesson-results" class="jump-results">${jumpResults(searchable, lessonSearch)}</div></div></div><div class="source-grid">${lessons.map(l => {
    const group = lessonCards(cards(), l.id), done = group.filter(c => state.progress[c.id]).length;
    const due = lessonQueue(cards(), state, l.id, 'review').length;
    const resume = readCursor(l.id);
    const started = done > 0 || (resume && resume > 1);
    return `<article class="panel course-card"><h2>${esc(localizeText(l.title))}</h2><p>${group.length} ${t('句', 'sentences')} · ${t(`播音员 ${l.announcerCount} 句`, `${l.announcerCount} from the announcer`)} · ${t(`已练 ${done}`, `done ${done}`)} · ${t(`到期 ${due}`, `due ${due}`)}</p><div class="progress-track" aria-label="${t(`已练习 ${done} / ${group.length} 句`, `${done} of ${group.length} practised`)}"><div class="progress-fill" style="width:${done / group.length * 100}%"></div></div>${lessonGo(l.id, done, group.length, due, started)}<details><summary class="help-text">${t('句序', 'Sentences')}</summary><ol class="sentence-list">${group.map(c => `<li><button class="text-button dark" data-action="open-card" data-id="${esc(c.id)}"><span class="tiny-label">${esc(c.speaker)}</span> ${esc(c.sentence)}</button></li>`).join('')}</ol></details></article>`;
  }).join('')}</div></section>`;
}
function startMine(source) {
  const list = allCards().filter(c => isMine(c) && c.source === source);
  if (!list.length) { toast(t('这个出处还没有可练习的句子', 'This source has no sentences yet')); return; }
  stopMedia();
  session = { ids: list.map(c => c.id), index: 0, revealed: false, typed: '', practice: false, mode: 'auto', sourceLabel: list[0].title || source };
  lastRating = null; renderSession(); window.scrollTo({ top: 0 });
}
function startLesson(lessonId, mode, order) {
  const full = lessonCards(cards(), lessonId);
  if (!full.length) return;
  let index = 0;
  if (order) index = Math.max(0, full.findIndex(c => c.order === Number(order)));
  else if (mode === 'review') {
    const due = lessonQueue(cards(), state, lessonId, 'review');
    if (!due.length) { toast(t('暂时没有到期句，按安排再来复习。', 'No sentences are due. Come back when the schedule says so.')); return; }
    index = Math.max(0, full.findIndex(c => c.id === due[0].id));
  } else if (mode === 'restart') index = 0;
  else {
    const saved = readCursor(lessonId);
    const savedIndex = saved ? full.findIndex(c => c.order === saved) : -1;
    const firstNew = full.findIndex(c => !state.progress[c.id]);
    if (firstNew < 0) { toast(t('本轮逐句听写已完成，可选择从头再练。', 'This dictation round is complete. You can start over.')); return; }
    index = savedIndex >= 0 ? savedIndex : firstNew;
  }
  stopMedia();
  session = { ids: full.map(c => c.id), index, revealed: false, typed: '', practice: false, mode: 'dictation', lessonId, lessonMode: mode, query: '' };
  if (mode !== 'review') writeCursor(lessonId, full[index].order);
  lastRating = null; renderSession(); window.scrollTo({ top: 0 });
}
function moveLesson(index) {
  if (!session?.lessonId) return;
  if (index < 0 || index >= session.ids.length) { toast(index < 0 ? t('已经是第一句', 'This is the first sentence') : t('已经是最后一句', 'This is the last sentence')); return; }
  if (index === session.index) return;
  stopMedia();
  session.index = index; session.revealed = false; session.typed = '';
  const card = cardById(session.ids[index]);
  if (session.lessonMode !== 'review' && card) writeCursor(session.lessonId, card.order);
  renderSession(); window.scrollTo({ top: 0 });
}
function audioElement() { return audioURL ? `<audio class="local-audio" controls src="${esc(audioURL)}" aria-label="${t('本地剑雅录音', 'Local Cambridge recording')}"></audio>` : ''; }
function hasLocalAudio(c) { return Boolean(c?.localAudio?.id); }
function clipRange(c) {
  return Number.isFinite(c?.audioStart) && Number.isFinite(c?.audioEnd) ? { start: c.audioStart, end: c.audioEnd } : null;
}
function remoteAudio(c) {
  if (hasLocalAudio(c)) {
    const range = clipRange(c);
    return `<div class="detail-block"><h3>${t('你导入的录音', 'Your recording')}</h3><p class="help-text">${esc(c.audioName || t('已配套音频', 'Audio attached'))}${range ? ` · ${range.start}–${range.end}s` : ''} · ${t('只保存在这台设备，用下方的播放收听。', 'Stored only on this device. Use Play below.')}</p></div>`;
  }
  if (!c.audio) return '';
  return `<div class="detail-block"><h3>${t('对应的剑雅原音片段', 'Matching original-audio clip')}</h3><p class="help-text">${esc(localizeText(c.audioSource || c.source))} · ${t('用下方的播放收听，到片段结尾自动暂停。', 'Use Play below. It pauses at the end of the clip.')}</p></div>`;
}
function playBar(c) {
  const mark = c.kind === 'listening' ? icon('headphones') : icon('speaker');
  return `<div class="play-bar"><label><span class="sr-only">${t('播放方式', 'Playback')}</span><select aria-label="${t('播放方式', 'Playback')}"><option value="once">${t('一遍', 'Once')}</option><option value="triple">${t('三遍', 'Three times')}</option><option value="slow">${t('慢速', 'Slow')}</option></select></label><button class="btn btn-secondary" data-action="play-audio" data-id="${esc(c.id)}">${mark} ${t('播放', 'Play')}</button><button class="btn btn-quiet" data-action="stop-audio">${t('停止', 'Stop')}</button></div>`;
}
function originalControls(c) {
  if (hasLocalAudio(c)) {
    const range = clipRange(c);
    return `${playBar(c)}<p class="audio-notice" data-original-status role="status">${esc(c.audioName || t('你导入的录音', 'Your recording'))}${range ? ` · ${range.start}–${range.end}s` : t(' · 整段', ' · whole file')} · ${t('三遍时每遍间隔 3 秒', 'Three plays leave a 3-second gap')}</p>`;
  }
  if (!c.audio) return `${playBar(c)}<p class="audio-notice" data-original-status role="status">${c.audioName ? esc(t(`还没有找到音频「${c.audioName}」。请到资料页的「其他方式」选择这个文件。`, `Audio “${c.audioName}” is not on this device yet. Choose it under Other ways in Settings.`)) : t('这条没有配套原录音，使用合成朗读。', 'This sentence has no original recording, so playback is synthetic.')}</p>`;
  return `${playBar(c)}<p class="audio-notice" data-original-status role="status">${t('原录音 · 三遍时每遍间隔 3 秒', 'Original recording · three plays leave a 3-second gap')}</p>`;
}
function listeningCue(c) {
  if (hasLocalAudio(c)) return t('先听你导入的录音，再把句子写下来。', 'Listen to the recording you added, then write the sentence.');
  if (c.audio) return t('先听对应的剑雅原音，再尝试写下句子。', 'Listen to the Cambridge recording, then try to write the sentence.');
  return t('先听一遍朗读，再把句子写下来。这是合成朗读，用来练习你导入的句子。', 'Listen once, then write the sentence. This is a synthetic voice for a sentence you imported.');
}
async function hydrateLocalAudio() {
  for (const el of document.querySelectorAll('audio[data-local-id]:not([src])')) {
    const url = await clipObjectUrl(el.dataset.localId);
    if (!url) continue;
    const start = el.dataset.segmentStart, end = el.dataset.segmentEnd;
    el.src = start != null && end != null ? `${url}#t=${start},${end}` : url;
  }
}
function readingControls(c) {
  const voice = readingSpeech.has(c.sentence) ? t('自然英音', 'Natural British voice') : t('合成朗读', 'Synthetic voice');
  return `${playBar(c)}<p class="audio-notice">${voice}</p>`;
}
async function playOriginal(id, repeats = 1, rate = 1) {
  const c = cardById(id);
  if (hasLocalAudio(c)) {
    const url = await clipObjectUrl(c.localAudio.id);
    if (!url) { toast(c.audioName ? t(`这台设备上找不到「${c.audioName}」。请重新选择该音频。`, `“${c.audioName}” is not on this device. Choose the file again.`) : t('这台设备上找不到配套音频。请重新选择文件。', 'The audio is not on this device. Choose the file again.')); return; }
    const range = clipRange(c);
    playSegment(c, { url, start: range?.start || 0, end: range?.end ?? Number.POSITIVE_INFINITY }, repeats, rate, t('你导入的录音', 'Your recording'));
    return;
  }
  if (!c?.audio) { toast(t('这条反馈还缺对应原音，请补齐后再练习。', 'This item still needs its original audio.')); return; }
  playSegment(c, c.audio, repeats, rate, t('剑雅原声', 'Original recording'));
}
function playSegment(c, clip, repeats = 1, rate = 1, label = t('自然朗读 · AI合成', 'Natural voice · synthetic')) {
  stopMedia();
  const player = $('#shared-audio'); originalPlayer = player;
  player.src = clip.url; player.preload = 'metadata'; player.playbackRate = rate;
  if ('preservesPitch' in player) player.preservesPitch = true;
  $('#audio-dock').hidden = false; $('#audio-title').textContent = label;
  (document.querySelector('dialog[open]') || document.body).appendChild($('#audio-dock'));
  $('#audio-direct').href = clip.url; document.body.classList.add('audio-open');
  let played = 1, finishedThisPass = false;
  const status = message => { document.querySelectorAll('[data-original-status]').forEach(el => el.textContent = message); $('#audio-status').textContent = message; };
  const attemptPlay = () => {
    const blocked = () => { status(t('浏览器暂停了播放，请点下方播放器或“继续播放”。', 'Playback was paused. Use the player below, or Resume.')); $('#audio-resume').hidden = false; resumeAudio = attemptPlay; };
    try { const result = player.play(); if(result?.then) result.then(() => { $('#audio-resume').hidden = true; status(`${label} · 第 ${played}/${repeats} 遍`); }).catch(blocked); }
    catch { blocked(); }
  };
  const finished = () => {
    if (finishedThisPass || originalPlayer !== player) return;
    finishedThisPass = true; player.pause();
    if (played < repeats) {
      status(t(`原音第 ${played}/${repeats} 遍结束，停顿 3 秒…`, `Play ${played}/${repeats} finished. Pausing 3 seconds…`));
      originalRepeatTimer = setTimeout(() => {
        if (originalPlayer !== player) return;
        played++; finishedThisPass = false; player.currentTime = clip.start;
        status(t(`正在播放原音 · 第 ${played}/${repeats} 遍`, `Playing original audio · ${played}/${repeats}`));
        attemptPlay();
      }, 3000);
    } else status(t(`${label}播放完成${repeats > 1 ? ' · 共 3 遍' : ''}`, `${label} finished${repeats > 1 ? ' · 3 plays' : ''}`));
  };
  player.onloadedmetadata = () => { try { player.currentTime = clip.start; } catch {} };
  player.ontimeupdate = () => { if (player.currentTime >= clip.end) finished(); };
  player.onended = finished;
  player.onplay = () => { $('#audio-resume').hidden = true; if (finishedThisPass) { clearTimeout(originalRepeatTimer); played = played < repeats ? played+1 : 1; finishedThisPass = false; player.currentTime = clip.start; } };
  player.onerror = () => { status(t('音频加载失败，可点“单独打开音频”重试。', 'The audio failed to load. Open it on its own and try again.')); $('#audio-resume').hidden = false; resumeAudio = () => { player.load(); attemptPlay(); }; };
  status(t('正在加载音频…', 'Loading audio…')); attemptPlay();
}
function publishedOverride(c) {
  const remote = Object.values(publishedFeeds).flatMap(feed => feed.cards).find(card => card.id === c.id);
  if (!remote || !state.cards.some(card => card.id === c.id) || JSON.stringify(remote) === JSON.stringify(c)) return '';
  return `<div class="review-feedback">${t('你保留了这条知识的个人编辑，bot 也提供了更新版本。', 'You kept a personal edit, and the bot also has an update.')}<button class="text-button dark" data-action="use-published" data-id="${esc(c.id)}">${t('采用 bot 版本，保留复习进度', 'Use the bot version and keep progress')}</button></div>`;
}
function details(c) {
  const p = state.progress[c.id];
  const fields = [['feedback', t('我的反馈', 'My feedback')], ['note', t('理解这个难点', 'Why this point is tricky')], ['personalError', t('当时没听清的地方', 'What you missed')], ['pronunciation', t('连读、弱读与发音', 'Linking, weak forms and pronunciation')], ['grammar', t('原句语法', 'Grammar in the sentence')], ['speaker', t('原录音说话人', 'Speaker')], ['collocations', t('固定搭配', 'Collocations')], ['related', t('联系着记', 'Related points')], ['etymology', t('词源线索', 'Etymology')]];
  return `${publishedOverride(c)}<h3 class="word-heading" lang="en">${esc(c.target)}</h3>${c.ipa ? `<p class="ipa" lang="en">${esc(c.ipa)}</p>` : ''}<p>${esc(c.meaning || '')}</p>
    <div class="detail-block"><h3>${c.fragment ? t('剑雅原录音片段', 'Original recording clip') : t('剑雅原句', 'Cambridge sentence')} · ${esc(localizeText(c.source))}</h3><p class="english" lang="en">${highlighted(c)}</p>${c.translation ? `<p class="translation">${esc(c.translation)}</p>` : `<p class="help-text">${t('此句尚未补充整句翻译，可在编辑中补充；上方是知识点释义。', 'This sentence has no full translation yet. You can add one while editing. The gloss above is the point itself.')}</p>`}<p class="help-text">${esc(c.originalRef || '')}</p></div>
    ${fields.filter(([key]) => c[key]).map(([key, title]) => `<div class="detail-block"><h3>${title}</h3><p>${esc(key === 'speaker' ? c[key] : c[key])}</p></div>`).join('')}
    ${remoteAudio(c)}<div class="detail-block"><h3>${t('复习', 'Review')}</h3><p>${p ? t(`${p.reps} 次 · 忘记 ${p.lapses} · 下次 ${formatDate(p.due, true)}`, `${p.reps} recalls · ${p.lapses} forgotten · next ${formatDate(p.due, true)}`) : t('尚未开始', 'Not started')}</p></div>`;
}
function openCard(id) {
  const c = cardById(id); if (!c) return;
  stopMedia();
  const dialog = $('#card-dialog');
  dialog.dataset.cardId = id;
  dialog.innerHTML = `<div class="dialog-header"><div><h2 id="dialog-heading">${t('回到原句里', 'Back to the sentence')}</h2><div style="margin-top:8px">${badge(c)}</div></div><button class="icon-button" data-action="close-dialog" aria-label="${t('关闭知识卡', 'Close card')}">${icon('close')}</button></div>${details(c)}<div class="dialog-footer">${c.kind === 'listening' ? originalControls(c) : readingControls(c)}${favoriteButton(c)}<button class="btn btn-secondary" data-action="edit-card" data-id="${esc(id)}">${icon('edit')} ${t('编辑', 'Edit')}</button></div>`;
  if (!dialog.open) dialog.showModal();
  hydrateLocalAudio();
}
function startSession({ practice = false, mode = 'auto', kind = 'all' } = {}) {
  if (kind === 'listening' || mode === 'dictation') { renderPractice(); return; }
  let list = practice ? cards().filter(c => (kind === 'all' || c.kind === kind) && (c.kind !== 'listening' || c.audio || c.selfStudy)).sort(() => Math.random() - 0.5).slice(0, 5) : queueFor(cards(), state);
  if (!list.length) { toast(t('目前没有待学内容，可以去知识库看看。', 'Nothing is waiting. Browse the library instead.')); return; }
  session = { ids: list.map(c => c.id), index: 0, revealed: false, typed: '', practice, mode };
  lastRating = null;
  renderSession();
  window.scrollTo({ top: 0 });
}
function renderSession() {
  if (!session) return;
  const c = cardById(session.ids[session.index]);
  if (!c) { renderDone(); return; }
  const mode = session.mode === 'auto' ? (c.kind === 'listening' ? 'dictation' : 'cloze') : session.mode;
  const revealing = session.revealed;
  const task = mode === 'dictation' ? t('听一句，写下来', 'Listen, then write') : mode === 'cloze' ? t('把原句补完整', 'Complete the sentence') : t('从中文回到英文', 'From the gloss back to English');
  const matched = session.typed.trim() && checkAnswer(session.typed, mode === 'dictation' ? c.sentence : c.focus);
  const lessonMoves = session.lessonId ? `<button class="btn btn-secondary" data-action="lesson-prev" ${session.index ? '' : 'disabled'}>${t('上一句', 'Previous')}</button><button class="btn" data-action="lesson-next" ${session.index < session.ids.length - 1 ? '' : 'disabled'}>${t('下一句', 'Next sentence')}</button>` : '';
  const lessonSearchBox = session.lessonId ? `<div class="dictation-nav"><label class="search"><span class="sr-only">${t('在这一课里搜索', 'Search this lesson')}</span>${icon('search')}<input id="dictation-search" type="search" placeholder="${t('搜句号或原文', 'Search a number or the wording')}" value="${esc(session.query || '')}" autocomplete="off"></label><div id="dictation-results" class="jump-results">${jumpResults(lessonCards(cards(), session.lessonId), session.query || '')}</div></div>` : '';
  $('#main').innerHTML = `<div class="review-top"><div><h2>${session.lessonId ? esc(localizeText(c.title)) + t(' · 逐句听写', ' · dictation') : session.practice ? t('随手练习', 'Practice') : session.sourceLabel ? esc(localizeText(session.sourceLabel)) : t('今日学习', 'Today')}</h2><p>${session.index + 1} / ${session.ids.length} · ${c.lessonId ? t(`原声第 ${c.order} 句 · ${esc(c.speaker)} · `, `Sentence ${c.order} · ${esc(c.speaker)} · `) : ''}${task}</p></div><div class="review-actions">${lessonMoves}<button class="btn btn-quiet" data-action="undo" ${lastRating ? '' : 'disabled'}>${t('撤销上一条', 'Undo last')}</button><button class="btn btn-secondary" data-action="exit-session">${t('稍后继续', 'Continue later')}</button></div></div><div class="progress-track"><div class="progress-fill" style="width:${session.index / session.ids.length * 100}%"></div></div>${lessonSearchBox}
    <article class="review-card"><div class="card-topline">${badge(c)}<span class="source-short">${esc(localizeText(c.source))}</span></div>
    ${mode === 'dictation' && !revealing ? `<p class="prompt">${listeningCue(c)}</p>${originalControls(c)}${audioElement()}` : ''}
    ${!revealing && mode === 'cloze' ? `<p class="english" lang="en">${highlighted(c, true)}</p><p class="prompt">${t('中文提示：', 'Gloss: ')}${esc(c.meaning || c.translation)}</p>` : ''}
    ${!revealing && mode === 'recall' ? `<p class="prompt">${t('想想这个表达，在原句里是怎么说的？', 'How is this idea said in the original sentence?')}</p><p class="english">${esc(c.meaning || c.translation || t('回想原句中的表达', 'Recall the expression from the sentence'))}</p>` : ''}
    ${!revealing ? `<label for="study-answer" class="sr-only">${mode === 'dictation' ? t('写下你听到的句子', 'Write the sentence you hear') : t('输入回忆出的表达', 'Type the expression you recall')}</label><textarea id="study-answer" class="answer-input" placeholder="${mode === 'dictation' ? t('写下听到的句子', 'Write what you hear') : t('写下回忆出的表达', 'Write what you recall')}" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(session.typed)}</textarea><button class="btn reveal" data-action="reveal">${t('回忆好了，核对答案', 'Ready — check the answer')}</button>` : `
    ${session.typed.trim() ? `<div class="review-feedback ${matched ? '' : 'partial'}">${matched ? t('文字一致。', 'The wording matches.') : t(`对照：${esc(mode === 'dictation' ? c.sentence : c.focus)}`, `Compare: ${esc(mode === 'dictation' ? c.sentence : c.focus)}`)}<br><span class="tiny-label">${t('你的答案：', 'Your answer: ')}${esc(session.typed)}</span></div>` : ''}${details(c)}
    ${c.kind === 'listening' ? originalControls(c) : readingControls(c)}<div class="review-controls"><button class="btn btn-secondary" data-action="edit-card" data-id="${esc(c.id)}">${icon('edit')} ${t('编辑', 'Edit')}</button></div>
    ${session.practice ? `<button class="btn reveal" data-action="next-practice">${t('继续练习', 'Keep practising')}</button>` : `<div class="rating-grid">${[['again', t('忘了', 'Forgot')], ['hard', t('吃力', 'Hard')], ['good', t('记住', 'Got it')], ['easy', t('轻松', 'Easy')]].map(([rating, label]) => `<button class="rating" data-action="rate" data-rating="${rating}"><strong>${label}</strong><span>${later(schedule(state.progress[c.id], rating).due - Date.now())}</span></button>`).join('')}</div>`}`}</article>`;
  hydrateLocalAudio();
}
function renderDone() {
  const next = cards().map(c => state.progress[c.id]?.due).filter(t => t > Date.now()).sort((a, b) => a - b)[0];
  $('#main').innerHTML = `<section class="panel review-done"><span class="stat-icon">${icon('check')}</span><h1>${t('这几句，又熟悉了一点。', 'These sentences feel a little more familiar.')}</h1><p>${t(`完成 ${session.ids.length} 条。`, `Finished ${session.ids.length}.`)}${!session.practice && next ? t(`下次 ${formatDate(next, true)}。`, ` Next ${formatDate(next, true)}.`) : ''}</p><button class="btn" data-action="exit-session">${t('回到学习本', 'Back')}</button>${lastRating ? `<button class="btn btn-quiet" data-action="undo">${t('撤销上一条', 'Undo last')}</button>` : ''}</section>`;
}
function rate(rating) {
  if (!session?.revealed || session.practice) return;
  stopMedia();
  const id = session.ids[session.index], now = Date.now();
  lastRating = { id, previous: state.progress[id] ? cloneData(state.progress[id]) : null, index: session.index, eventId: uniqueId() };
  const isNew = !state.progress[id];
  state.progress[id] = schedule(state.progress[id], rating, now);
  state.events.push({ id: lastRating.eventId, cardId: id, at: now, day: dayKey(now), rating, isNew });
  persist(); session.index++; session.revealed = false; session.typed = '';
  const nextCard = cardById(session.ids[session.index]);
  if (session.lessonId && session.lessonMode !== 'review' && nextCard) writeCursor(session.lessonId, nextCard.order);
  refreshNav(); renderSession(); window.scrollTo({ top: 0 });
}
function undoRating() {
  if (!lastRating || !session) return;
  if (lastRating.previous) state.progress[lastRating.id] = lastRating.previous; else delete state.progress[lastRating.id];
  state.events = state.events.filter(e => e.id !== lastRating.eventId);
  session.index = lastRating.index; session.revealed = true; session.typed = ''; lastRating = null; persist();
  const restored = cardById(session.ids[session.index]);
  if (session.lessonId && session.lessonMode !== 'review' && restored) writeCursor(session.lessonId, restored.order);
  render(); toast(t('已撤销上一条评分', 'Undid the last rating'));
}
const template = { schemaVersion: 1, cards: [{ id: 'c17-t1-p1-congested', kind: 'reading', target: 'congested', meaning: '拥挤的；堵塞的', sentence: 'In the first half of the 1800s, London’s population grew at an astonishing rate, and the central area became increasingly congested.', focus: 'congested', source: '剑雅 17 · Test 1 · Passage 1', title: '伦敦地下铁路的发展', translation: '19世纪上半叶，伦敦人口以惊人的速度增长，市中心变得越来越拥挤。', ipa: '/kənˈdʒestɪd/', note: 'become increasingly + 形容词：变得越来越……', collocations: 'become increasingly congested', personalError: '', tags: ['词汇', '搭配'] }] };
const grokPrompt = `请只整理我在本次对话反馈过的不熟悉内容，不要额外推荐新词。每条必须配真实剑雅原句或原录音片段及书册、Test、Passage/Section 出处。不要把改写句冒充原句；无法核实的句子先不要输出。请按以下 JSON 格式输出，可直接复制保存为 .json 导入 MyIELTS。kind 用 reading 或 listening；id 要稳定且唯一，focus 必须原样出现在 sentence 中。提供中文释义、整句翻译、根据我的难点补发音/音标、语法、搭配与易错解释；没有依据的词源不要编写。仅输出 JSON，不含 Markdown 代码围栏。\n\n${JSON.stringify(template, null, 2)}`;
function appearancePanel() {
  const language = state.settings.language === 'en' ? 'en' : 'zh';
  const theme = state.settings.theme === 'dark' ? 'dark' : 'light';
  const textSize = ['sm', 'md', 'lg', 'xl'].includes(state.settings.textSize) ? state.settings.textSize : 'md';
  return `<section class="panel"><h2>${t('界面', 'Display')}</h2><div class="settings-row"><label for="ui-language">${t('语言', 'Language')}</label><select id="ui-language">${[['zh', '中文'], ['en', 'English']].map(([value, label]) => `<option value="${value}" ${language === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="settings-row"><label for="ui-theme">${t('外观', 'Appearance')}</label><select id="ui-theme">${[['light', t('浅色', 'Light')], ['dark', t('深色', 'Dark')]].map(([value, label]) => `<option value="${value}" ${theme === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="settings-row"><label for="ui-text">${t('字号', 'Text size')}</label><select id="ui-text">${[['sm', t('较小', 'Smaller')], ['md', t('标准', 'Standard')], ['lg', t('较大', 'Larger')], ['xl', t('大', 'Large')]].map(([value, label]) => `<option value="${value}" ${textSize === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div></section>`;
}
function materialPanel() {
  const scope = state.settings.studyScope || 'all';
  return `<section class="panel wide mine-panel"><h2>${t('导入想学的原题和错题', 'Add the sentences you want')}</h2>
    <p class="help-text import-lead">${t('把要学、要练、要复习的原句贴到下面，再点「导入知识卡」。怎么写，打开「预览示例」。', 'Paste the sentences you want to study, practise and review, then choose Import cards. Open Preview an example to see the format.')}</p>
    <label class="form-field scope-field">${t('学习范围', 'What to study')}<select id="study-scope" aria-label="${t('学习范围', 'What to study')}">${[['all', t('全部', 'Everything')], ['mine', t('只学我导入的', 'Only what I added')], ['builtin', t('只学站内', 'Only built-in')]].map(([value, label]) => `<option value="${value}" ${scope === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <p class="help-text">${t('今日学习按这里排：全部、只排你导入的，或只排站内资料。', 'Today is scheduled from this: everything, only what you added, or only the built-in material.')}</p>
    <label class="form-field" for="import-json">${t('粘贴你的原题或错题', 'Paste your sentences')}<textarea id="import-json" rows="7" placeholder="${t('出处: 剑雅 18 · Test 2 · Passage 1\n原句: 在这里贴上你要记的原句', 'source: Cambridge IELTS 18 · Test 2 · Passage 1\nsentence: Paste the sentence you want to remember')}"></textarea></label>
    <div class="import-actions"><button class="btn" data-action="import-paste">${t('导入知识卡', 'Import cards')}</button><select id="import-extra" aria-label="${t('其他方式', 'Other ways')}"><option value="">${t('其他方式', 'Other ways')}</option><option value="file">${t('从文件导入', 'From a file')}</option><option value="audio">${t('配套音频', 'Matching audio')}</option><option value="manual">${t('手动记一条', 'Add one card')}</option></select><button class="btn btn-secondary" type="button" data-action="toggle-example" aria-expanded="false" aria-controls="import-example">${t('预览示例', 'Preview an example')}</button></div>
    <input id="import-file" class="offscreen-file" data-file="cards" type="file" accept=".json,.txt,text/plain,application/json" tabindex="-1">
    <input id="import-audio" class="offscreen-file" data-file="clips" type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm,.flac" multiple tabindex="-1">
    <p id="import-error" class="error-text" role="alert"></p>
    <div id="import-example" class="import-example" hidden>
      <ol class="import-guide">
        <li>${t('粘贴进来的句子会进入今日学习的复习排期，也能在随手练习里按出处练习。已经有的复习进度会保留。', 'Pasted sentences join today’s review schedule and can be practised by source. Review progress you already have is kept.')}</li>
        <li>${t('每条至少两行。第一行写出处，例如「出处: 剑雅 18 · Test 2 · Passage 1」。下一行写原句，例如「原句: The city became increasingly congested.」', 'Each item needs at least two lines. First the source, for example “source: Cambridge IELTS 18 · Test 2 · Passage 1”. Next the sentence, for example “sentence: The city became increasingly congested.”')}</li>
        <li>${t('想重点记的一段，再写「考点: congested」。不写的话，整句用来填空或听写。释义、翻译、错因、讲解可以接着写。', 'Add “focus: congested” for the part you want to remember. Leave it out to practise the whole sentence. A gloss, translation, what you missed and a note can follow.')}</li>
        <li>${t('下一条之前单独一行写 ---。听力若有录音，写「音频: 文件名.mp3」。多句共用一段时，再写「开始」和「结束」，单位是秒。', 'Before the next item, put --- on its own line. For a recording, add “audio: file.mp3”. If several sentences share one file, add start and end in seconds.')}</li>
        <li>${t('写好后粘贴到上面的框里，点「导入知识卡」。从文件导入、给句子配音频，或手动记一条，都在「其他方式」里。音频只保存在这台设备。', 'Paste it into the box above and choose Import cards. Importing a file, attaching audio, or adding one card by hand are under Other ways. Audio stays on this device.')}</li>
      </ol>
      <p class="help-text">${t('下面是一条阅读、一条听力。把出处和原句换成你自己的，再粘贴到上面即可，不用下载。', 'One reading item and one listening item. Replace the source and sentence with your own, paste it above, and there is nothing to download.')}</p>
      <pre class="template">${esc(EXAMPLE_PACK)}</pre>
    </div>
  </section>`;
}
function renderSettings() {
  $('#main').innerHTML = `${intro('', t('资料与设置', 'Settings'), '')}
    <div class="settings-grid">${materialPanel()}${appearancePanel()}<section class="panel"><h2>${t('节奏', 'Pace')}</h2><div class="settings-row"><label for="daily-new">${t('每日新学', 'New cards a day')}</label><input id="daily-new" type="number" min="0" max="30" step="1" value="${state.settings.dailyNew}"></div><div class="settings-row"><label for="speech-rate">${t('朗读', 'Reading speed')}</label><select id="speech-rate">${[[0.65, t('慢速', 'Slow')], [0.85, t('舒缓', 'Relaxed')], [1, t('自然', 'Natural')], [1.15, t('稍快', 'Faster')]].map(([n, l]) => `<option value="${n}" ${Math.abs(state.settings.rate - n) < .01 ? 'selected' : ''}>${l}</option>`).join('')}</select></div></section>
    <section class="panel"><h2>${t('备份', 'Backup')}</h2><p>${t('进度只在这台浏览器里，换设备前请导出。', 'Progress stays in this browser. Export before changing devices.')}</p><div class="settings-actions"><button class="btn btn-secondary" data-action="export">${icon('download')} ${t('导出完整备份', 'Export full backup')}</button><label class="btn btn-secondary import-label">${t('合并恢复', 'Merge a backup')}<input class="file-input" data-file="backup" type="file" accept=".json,application/json"></label></div>${rawRecovery ? `<button class="text-button" data-action="export-raw">${t('下载原始数据', 'Download raw data')}</button>` : ''}</section>
    <section class="panel"><h2>${t('离线', 'Offline')}</h2><p class="help-text" id="cache-detail">${t('正在检查…', 'Checking…')}</p><div class="settings-actions"><button class="btn btn-secondary" data-action="update">${t('检查网页更新', 'Check for a page update')}</button></div></section>
    ${syncPanel()}
    <section class="panel wide"><h2>${t('复习怎么排', 'How review is spaced')}</h2><p>${t('先回忆再核对。间隔从 1、3、7、14、30、60、120 天起，按忘了、吃力、记住、轻松调整。', 'Recall, then check. Intervals start at 1, 3, 7, 14, 30, 60 and 120 days, then follow Forgot, Hard, Got it and Easy.')}</p><a class="inline-link help-text" href="https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html" target="_blank" rel="noopener">${t('研究依据', 'The research')}</a></section></div>`;
  updateConnection(); updateFeedStatus();
}
function editCard(id) {
  const c = id ? cardById(id) : null;
  $('#card-dialog').close();
  const fields = [['target', t('知识点 / 不熟悉的表达', 'The point you do not know yet'), false], ['meaning', t('中文释义', 'Chinese gloss'), false], ['source', t('出处（书册 / Test / Passage 或 Section）', 'Source (book / Test / Passage or Section)'), true], ['focus', t('原句中要填空的片段（不填则用整句）', 'Blank this to practise the whole sentence'), false], ['sentence', t('原句 / 原录音文本', 'Original sentence'), true], ['translation', t('整句中文翻译', 'Full Chinese translation'), false], ['ipa', t('音标', 'Phonetic spelling'), false], ['title', t('篇章 / 场景名称', 'Passage or scene title'), false], ['note', t('讲解', 'Explanation'), false], ['feedback', t('相关反馈', 'Feedback'), false], ['collocations', t('固定搭配', 'Collocations'), false], ['personalError', t('我的错答 / 错因', 'What I got wrong'), false], ['etymology', t('有依据的词源（可选）', 'Etymology, only when sourced'), false]];
  $('#edit-dialog').innerHTML = `<div class="dialog-header"><h2 id="edit-heading">${c ? t('补充这条知识', 'Add to this card') : t('记下一个难点', 'Record a sticking point')}</h2><button class="icon-button" data-action="close-dialog" aria-label="${t('关闭编辑', 'Close editor')}">${icon('close')}</button></div><form id="card-form" data-id="${esc(id || '')}"><div class="form-grid"><label class="form-field">${t('学习类型', 'Type')}<select name="kind"><option value="reading">${t('阅读', 'Reading')}</option><option value="listening" ${c?.kind === 'listening' ? 'selected' : ''}>${t('听力', 'Listening')}</option></select></label><label class="form-field">${t('原句形式', 'Sentence form')}<select name="fragment"><option value="false">${t('完整原句', 'Full sentence')}</option><option value="true" ${c?.fragment ? 'selected' : ''}>${t('原录音 / 原文片段', 'Recording or text clip')}</option></select></label>${fields.map(([key, label, required]) => `<label class="form-field ${['sentence', 'translation', 'note', 'feedback', 'personalError', 'etymology'].includes(key) ? 'wide' : ''}">${label}${required ? ' *' : ''}${['sentence', 'translation', 'note', 'feedback', 'personalError', 'etymology'].includes(key) ? `<textarea name="${key}" ${required ? 'required' : ''} maxlength="12000">${esc(c?.[key] || '')}</textarea>` : `<input name="${key}" value="${esc(c?.[key] || '')}" ${required ? 'required' : ''} maxlength="12000">`}</label>`).join('')}</div><fieldset class="clip-fields"><legend>${t('配套音频', 'Audio for this sentence')}</legend><p class="help-text">${t('听力可选一个录音。多句共用同一文件时，填写开始和结束（秒）；留空则播放整段。阅读会忽略这里。', 'For listening, choose one recording. If several sentences share it, enter start and end in seconds. Leave both blank to play the whole file. Reading ignores this.')}</p>${c?.audioName || c?.localAudio ? `<p class="help-text">${t('当前文件：', 'Current file: ')}${esc(c.audioName || t('已配套', 'Attached'))}</p>` : ''}<input name="audioFile" type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm,.flac"><div class="clip-times"><label>${t('开始（秒）', 'Start (seconds)')}<input name="audioStart" inputmode="decimal" value="${c?.audioStart ?? ''}"></label><label>${t('结束（秒）', 'End (seconds)')}<input name="audioEnd" inputmode="decimal" value="${c?.audioEnd ?? ''}"></label></div>${c?.localAudio ? `<button type="button" class="text-button" data-action="clear-clip">${t('移除配套音频', 'Remove audio')}</button>` : ''}</fieldset><p id="edit-error" class="error-text" role="alert"></p><p class="help-text">${t('原句和出处请与手头材料核对。考点留空时，整句用来填空或听写。保存不会重置复习排期。', 'Check the sentence and source against your material. Leave the focus blank to practise the whole sentence. Saving does not reset the review schedule.')}</p><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-dialog">${t('取消', 'Cancel')}</button><button class="btn" type="submit">${t('保存知识卡', 'Save card')}</button></div></form>`;
  $('#edit-dialog').showModal();
}
function withKnownAudio(card) {
  const previous = state.cards.find(c => c.id === card.id);
  if (!card.audioName && previous?.audioName && !card.audio) {
    card = { ...card, audioName: previous.audioName };
    if (previous.audioStart != null) card = { ...card, audioStart: previous.audioStart, audioEnd: previous.audioEnd };
    if (previous.localAudio) card = { ...card, localAudio: previous.localAudio };
  }
  if (!card.audioName) return card;
  const hit = clipForName(card.audioName);
  if (!hit) { const copy = { ...card }; delete copy.localAudio; return copy; }
  return { ...card, localAudio: { id: hit.id } };
}
function applyKnownAudio() {
  const missing = new Set();
  state.cards = state.cards.map(card => {
    if (!card.audioName) return card;
    const hit = clipForName(card.audioName);
    if (!hit) {
      missing.add(card.audioName);
      if (!card.localAudio) return card;
      const copy = { ...card }; delete copy.localAudio; return copy;
    }
    if (card.localAudio?.id === hit.id) return card;
    return { ...card, localAudio: { id: hit.id } };
  });
  return [...missing];
}
function importCards(data) {
  let incoming = parseStudyPack(data).map(withKnownAudio);
  if (!incoming.length) throw new Error(t('没有可导入的知识卡', 'There are no cards to import'));
  incoming = validateCards(incoming);
  state.cards = [...new Map([...state.cards, ...incoming].map(c => [c.id, c])).values()];
  persist();
  const hidden = (state.settings.studyScope || 'all') === 'builtin';
  const linked = incoming.filter(c => c.localAudio).length;
  const missing = [...new Set(incoming.filter(c => c.audioName && !c.localAudio).map(c => c.audioName))];
  const audioNote = `${linked ? t(`其中 ${linked} 条已配上音频。`, ` ${linked} now have audio.`) : ''}${missing.length ? t(`还没有找到 ${missing.slice(0, 3).join('、')}。请在「其他方式」里选配套音频。`, ` Still missing ${missing.slice(0, 3).join(', ')}. Choose Matching audio under Other ways.`) : ''}`;
  toast(hidden ? t(`已导入 ${incoming.length} 条。当前只显示站内资料，把学习范围改成「全部」或「只学我导入的」即可看到。`, `Imported ${incoming.length} cards. The current scope shows built-in material only. Switch to Everything or Only what I added.`) + audioNote : t(`已导入 ${incoming.length} 条，已有复习进度已保留。`, `Imported ${incoming.length} cards. Existing review progress is unchanged.`) + audioNote);
  render();
}
function download(data, filename, isRaw = false) {
  const body = isRaw || typeof data === 'string' ? String(data) : JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: filename.endsWith('.txt') ? 'text/plain;charset=utf-8' : 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function speak(id, slow = false) {
  const originalCard = cardById(id); if (originalCard?.kind === 'listening' && (hasLocalAudio(originalCard) || originalCard.audio)) { playOriginal(id, 1, slow ? .8 : 1); return; }
  const natural = readingSpeech.get(originalCard?.sentence);
  if (natural) { playSegment(originalCard, {url:natural.url,start:0,end:natural.duration}, 1, slow ? .8 : state.settings.rate); return; }
  if (!('speechSynthesis' in window)) { toast(t('此浏览器不支持合成朗读，请使用本地原录音。', 'This browser cannot speak the sentence. Use a local recording instead.')); return; }
  const c = cardById(id); if (!c) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(c.sentence);
  utterance.lang = 'en-GB'; utterance.rate = slow ? 0.65 : state.settings.rate;
  const voices = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang));
  const score = v => (/natural|neural|premium|enhanced/i.test(v.name) ? 100 : 0) + (/Google|Siri|Samantha|Daniel|Serena/i.test(v.name) ? 30 : 0) + (/en[-_]GB/i.test(v.lang) ? 20 : 0);
  const voice = voices.sort((a,b) => score(b)-score(a))[0];
  if (voice) utterance.voice = voice;
  utterance.onerror = () => toast(t('语音暂不可用，试试联网或播放本地原录音。', 'Speech is unavailable. Try a connection, or play a local recording.'));
  speechSynthesis.speak(utterance);
}
function stopMedia() { clearTimeout(originalRepeatTimer); originalRepeatTimer = null; resumeAudio = null; if (originalPlayer) { originalPlayer.pause(); originalPlayer = null; } window.speechSynthesis?.cancel(); document.querySelectorAll('audio').forEach(a => a.pause()); if ($('#audio-dock')) { $('#audio-dock').hidden = true; document.body.appendChild($('#audio-dock')); } document.body.classList.remove('audio-open'); }

async function refreshReadingSpeech(live = false) {
  const apply = data => {
    if (data?.kind !== 'synthetic-reading' || !Array.isArray(data.clips) || data.clips.length > 5000) throw new Error('阅读朗读索引无效');
    const incoming = new Map();
    for (const c of data.clips) {
      const url = new URL(c.url, location.href);
      const localPreview = url.protocol === 'http:' && url.origin === location.origin;
      if (typeof c.sentence !== 'string' || c.sentence.length > 12000 || !Number.isFinite(c.duration) || c.duration <= 0 || c.duration > 300 || (url.protocol !== 'https:' && !localPreview) || url.username || url.password) throw new Error('阅读朗读片段无效');
      incoming.set(c.sentence, {...c,url:url.href});
    }
    for (const [sentence,clip] of incoming) readingSpeech.set(sentence,clip);
  };
  const timeout=timeoutRequest();
  try {
    if (!live) { try { const cached=localStorage.getItem('myielts.readingAudio.v1'); if(cached)apply(JSON.parse(cached)); } catch {} }
    const response=await fetch(live ? `./feeds/reading-audio.json?v=${Date.now()}` : './data/reading-audio.json',{cache:live?'no-store':'default',signal:timeout.signal});
    if(!response.ok)throw new Error();
    const data=await response.json();apply(data);
    try {localStorage.setItem('myielts.readingAudio.v1',JSON.stringify(data));} catch {}
  } catch { /* Native browser speech remains available for uncached new sentences. */ }
  finally {timeout.clear();}
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (action === 'open-feedback') { const dialog = $('#feedback-dialog'); if (dialog && !dialog.open) dialog.showModal(); }
  if (action === 'open-support') { const dialog = $('#support-dialog'); if (dialog && !dialog.open) dialog.showModal(); }
  if (action === 'toggle-example') { const box = $('#import-example'); if (box) { box.hidden = !box.hidden; const open = !box.hidden; button.setAttribute('aria-expanded', String(open)); button.textContent = open ? t('收起示例', 'Hide example') : t('预览示例', 'Preview an example'); } }
  if (action === 'start-review') startSession();
  if (action === 'study-mine') startMine(button.dataset.source);
  if (action === 'set-scope' && ['all', 'mine', 'builtin'].includes(button.dataset.scope)) {
    state.settings.studyScope = button.dataset.scope; persist(); render();
    toast(button.dataset.scope === 'mine' ? t('接下来只安排你导入的内容。', 'Only your imported cards are scheduled.') : button.dataset.scope === 'builtin' ? t('接下来只安排站内资料。', 'Only the built-in material is scheduled.') : t('站内资料和你导入的内容都会安排。', 'Built-in and imported cards are both scheduled.'));
  }
  if (action === 'lesson') {
    const select = button.closest('.lesson-go')?.querySelector('select');
    const mode = select?.value || button.dataset.mode || 'continue';
    if (select?.selectedOptions?.[0]?.disabled) toast(t('换一种还可用的练习方式。', 'Choose a practice option that is available.'));
    else startLesson(button.dataset.lesson, mode);
  }
  if (action === 'jump-lesson') startLesson(button.dataset.lesson, 'continue', button.dataset.order);
  if (action === 'lesson-next' && session?.lessonId) moveLesson(session.index + 1);
  if (action === 'lesson-prev' && session?.lessonId) moveLesson(session.index - 1);
  if (action === 'sync-content') refreshPublished(true);
  if (action === 'copy-chosen') {
    const kind = $('#copy-kind')?.value === 'listening' ? 'listening' : $('#copy-kind')?.value === 'prompt' ? 'prompt' : 'reading';
    if (kind === 'prompt') {
      try { await navigator.clipboard.writeText(grokPrompt); toast(t('整理指令已复制，粘贴给 Grok 即可。', 'The organising prompt is copied. Paste it to Grok.')); }
      catch { const dialog = $('#card-dialog'); dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-heading">${t('整理指令', 'Organising prompt')}</h2><button class="icon-button" data-action="close-dialog" aria-label="${t('关闭整理指令', 'Close the prompt')}">${icon('close')}</button></div><pre class="template">${esc(grokPrompt)}</pre>`; dialog.showModal(); }
    } else {
      const instruction = botInstructions(kind);
      try { await navigator.clipboard.writeText(instruction); toast(t('配置指令已复制，发给对应 bot 一次即可。', 'Instructions copied. Send them to the matching bot once.')); }
      catch { const dialog = $('#card-dialog'); dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-heading">${t('Bot 配置指令', 'Bot instructions')}</h2><button class="icon-button" data-action="close-dialog" aria-label="${t('关闭配置指令', 'Close instructions')}">${icon('close')}</button></div><pre class="template">${esc(instruction)}</pre>`; dialog.showModal(); }
    }
  }
  if (action === 'copy-bot-setup') {
    const instruction = botInstructions(button.dataset.kind);
    try { await navigator.clipboard.writeText(instruction); toast(t('配置指令已复制，发给对应 bot 一次即可。', 'Instructions copied. Send them to the matching bot once.')); }
    catch { const dialog = $('#card-dialog'); dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-heading">${t('Bot 配置指令', 'Bot instructions')}</h2><button class="icon-button" data-action="close-dialog" aria-label="${t('关闭配置指令', 'Close instructions')}">${icon('close')}</button></div><pre class="template">${esc(instruction)}</pre>`; dialog.showModal(); }
  }
  if (action === 'use-published') { state.cards = state.cards.filter(c => c.id !== id); persist(); openCard(id); toast(t('已采用 bot 版本，复习进度已保留。', 'Using the bot version. Review progress is unchanged.')); }
  if (action === 'practice') startSession({ practice: true, mode: button.dataset.mode, kind: button.dataset.kind });
  if (action === 'open-card') openCard(id);
  if (action === 'new-card') editCard();
  if (action === 'edit-card') editCard(id);
  if (action === 'close-dialog') button.closest('dialog').close();
  if (action === 'favorite') {
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id]; persist();
    if ($('#card-dialog').open) openCard(id); else render();
  }
  if (action === 'filter-kind') { filters.kind = button.dataset.kind; filters.limit = 30; renderLibrary(); }
  if (action === 'filter-favorite') { filters.favorite = !filters.favorite; filters.limit = 30; renderLibrary(); }
  if (action === 'load-more') { filters.limit += 30; renderLibrary(); }
  if (action === 'source') { filters = { kind: 'all', source: button.dataset.source, search: '', favorite: false, limit: 30 }; location.hash = 'library'; if (route === 'library') renderLibrary(); }
  if (action === 'reveal' && session) { session.typed = $('#study-answer').value; session.revealed = true; stopMedia(); renderSession(); }
  if (action === 'rate') { rate(button.dataset.rating); }
  if (action === 'undo') undoRating();
  if (action === 'next-practice') { stopMedia(); session.index++; session.revealed = false; session.typed = ''; renderSession(); window.scrollTo({ top: 0 }); }
  if (action === 'exit-session') { stopMedia(); session = null; lastRating = null; render(); }
  if (action === 'play-audio') {
    const mode = button.closest('.play-bar')?.querySelector('select')?.value || 'once';
    const card = cardById(id);
    if (mode === 'triple') {
      if (card && (hasLocalAudio(card) || card.audio)) playOriginal(id, 3, 1);
      else {
        const natural = readingSpeech.get(card?.sentence);
        if (natural) playSegment(card, { url: natural.url, start: 0, end: natural.duration }, 3, state.settings.rate);
        else speak(id, false);
      }
    } else speak(id, mode === 'slow');
  }
  if (action === 'speak' || action === 'speak-slow') speak(id, action === 'speak-slow');
  if (action === 'original-play') playOriginal(id);
  if (action === 'original-triple') playOriginal(id, 3);
  if (action === 'original-slow') playOriginal(id, 1, .8);
  if (action === 'stop-audio') { stopMedia(); toast(t('音频已停止', 'Audio stopped')); }
  if (action === 'resume-audio' && resumeAudio) resumeAudio();
  if (action === 'close-audio') stopMedia();
  if (action === 'clear-clip') { const form = button.closest('form'); if (form) { form.dataset.clearClip = '1'; button.replaceWith(Object.assign(document.createElement('p'), { className: 'help-text', textContent: t('保存时会移除配套音频。', 'Audio will be removed when you save.') })); } }
  if (action === 'export') {
    let audioClips = [];
    try { audioClips = await exportClips([...new Set(state.cards.map(c => c.localAudio?.id).filter(Boolean))]); } catch { audioClips = []; }
    download({ ...state, cards: cards(), localCardIds: state.cards.map(c => c.id), ...(audioClips.length ? { audioClips } : {}) }, `myielts-backup-${dayKey()}.json`);
  }
  if (action === 'export-raw') download(rawRecovery, 'myielts-recovery.json', true);
  if (action === 'download-template') download(EXAMPLE_PACK, 'myielts-import.txt');
  if (action === 'copy-prompt') {
    try { await navigator.clipboard.writeText(grokPrompt); toast(t('整理指令已复制，粘贴给 Grok 即可。', 'The organising prompt is copied. Paste it to Grok.')); }
    catch { const details = $('details'); if (details) details.open = true; toast(t('请展开指令后手动复制。', 'Open the prompt and copy it by hand.')); }
  }
  if (action === 'import-paste') {
    try { importCards($('#import-json').value); }
    catch (error) { $('#import-error').textContent = error.message; }
  }
  if (action === 'update') {
    if (!swRegistration) { toast(t('离线服务暂不可用，请联网刷新网页。', 'Offline support is unavailable. Refresh while online.')); return; }
    try { await swRegistration.update(); if (swRegistration.waiting) { applyUpdate = true; swRegistration.waiting.postMessage('SKIP_WAITING'); } else toast(t('已检查更新。若有新版本，下载完成后再次点击即可应用。', 'Checked for an update. If a new version downloads, click again to apply it.')); }
    catch { toast(t('检查更新失败，联网后再试。', 'Could not check for an update. Try again online.')); }
  }
});
function listeningCatalog() {
  return (publishedFeeds.listening?.lessons || []).flatMap(lesson => lessonCards(cards(), lesson.id));
}
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  if (event.target.id !== 'dictation-search' && event.target.id !== 'lesson-search') return;
  event.preventDefault();
  const list = event.target.id === 'dictation-search' && session?.lessonId ? lessonCards(cards(), session.lessonId) : listeningCatalog();
  const match = findLessonSentences(list, event.target.value, 1)[0];
  if (!match) { toast(t('没有匹配的句子', 'No matching sentence')); return; }
  startLesson(match.lessonId, 'continue', match.order);
});
document.addEventListener('input', event => {
  if (event.target.id === 'library-search') { filters.search = event.target.value; filters.limit = 30; renderLibrary(true); }
  if (event.target.id === 'lesson-search') { lessonSearch = event.target.value; const box = $('#lesson-results'); if (box) box.innerHTML = jumpResults(listeningCatalog(), lessonSearch); }
  if (event.target.id === 'dictation-search' && session?.lessonId) { session.query = event.target.value; const box = $('#dictation-results'); if (box) box.innerHTML = jumpResults(lessonCards(cards(), session.lessonId), session.query); }
  if (event.target.id === 'study-answer' && session) session.typed = event.target.value;
});
document.addEventListener('change', async event => {
  const el = event.target;
  if (el.id === 'source-filter') { filters.source = el.value; filters.limit = 30; renderLibrary(); }
  if (el.id === 'kind-filter') {
    if (el.value === 'saved') { filters.favorite = true; filters.kind = 'all'; }
    else { filters.favorite = false; filters.kind = ['reading', 'listening'].includes(el.value) ? el.value : 'all'; }
    filters.limit = 30; renderLibrary();
  }
  if (el.id === 'import-extra') {
    const value = el.value;
    if (!value) return;
    if (value === 'file') $('#import-file')?.click();
    else if (value === 'audio') $('#import-audio')?.click();
    else if (value === 'manual') editCard();
    setTimeout(() => { if (el.isConnected) el.value = ''; }, 0);
  }
  if (el.id === 'ui-language' || el.id === 'ui-theme' || el.id === 'ui-text') {
    if (el.id === 'ui-language') state.settings.language = el.value === 'en' ? 'en' : 'zh';
    if (el.id === 'ui-theme') state.settings.theme = el.value === 'dark' ? 'dark' : 'light';
    if (el.id === 'ui-text' && ['sm', 'md', 'lg', 'xl'].includes(el.value)) state.settings.textSize = el.value;
    persist(); applyChrome(); render(); toast(t('界面设置已保存', 'Display settings saved'));
  }
  if (el.id === 'study-scope' && ['all', 'mine', 'builtin'].includes(el.value)) { state.settings.studyScope = el.value; persist(); render(); toast(t('学习范围已保存', 'Study scope saved')); }
  if (el.id === 'daily-new') { const n = Number(el.value); if (el.value !== '' && Number.isInteger(n) && n >= 0 && n <= 30) { state.settings.dailyNew = n; persist(); toast(t('每日新学量已保存', 'Daily new-card limit saved')); } else { el.value = state.settings.dailyNew; toast(t('请填写 0 到 30 的整数', 'Enter a whole number from 0 to 30')); } }
  if (el.id === 'speech-rate') { state.settings.rate = Number(el.value); persist(); }
  if (el.dataset.file === 'clips' && el.files?.length) {
    try {
      const saved = [];
      for (const file of el.files) saved.push(await saveClip(file));
      const missing = applyKnownAudio();
      persist(); render();
      const linked = state.cards.filter(c => saved.some(s => s.id === c.localAudio?.id)).length;
      const still = missing.length ? t(`还缺 ${missing.slice(0, 3).join('、')}。`, ` Still missing ${missing.slice(0, 3).join(', ')}.`) : '';
      toast(t(`已保存 ${saved.length} 个音频${linked ? `，配到 ${linked} 条` : ''}。${still}`, `Saved ${saved.length} audio file${saved.length === 1 ? '' : 's'}${linked ? `, linked to ${linked}` : ''}.${still}`));
    } catch (error) { toast(t(`音频没有保存：${error.message}`, `The audio was not saved: ${error.message}`)); }
    el.value = '';
    return;
  }
  if (el.dataset.file && el.files?.[0]) {
    const file = el.files[0];
    if (el.dataset.file === 'audio') {
      if (audioURL) URL.revokeObjectURL(audioURL); audioURL = URL.createObjectURL(file); render(); toast(t('本地录音已选择，只在本次打开期间使用。要固定到某一句，请到资料页的「其他方式」选配套音频。', 'Local recording selected for this visit. To keep it on a sentence, choose Matching audio under Other ways in Settings.')); return;
    }
    try {
      const limit = el.dataset.file === 'backup' ? 120 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > limit) throw new Error(el.dataset.file === 'backup' ? t('备份超过 120 MB', 'The backup is over 120 MB') : t('JSON 文件超过 20 MB，请分批导入', 'The JSON file is over 20 MB. Import it in smaller batches'));
      const raw = await file.text();
      if (el.dataset.file === 'backup') {
        const parsed = JSON.parse(raw);
        state = mergeBackup(state, parsed); canStore = true;
        const restored = await restoreClips(parsed.audioClips);
        applyKnownAudio();
        persist(); if (canStore) $('#storage-warning').hidden = true; applyChrome(); render();
        toast(restored ? t(`备份已合并，并恢复 ${restored} 个音频。`, `Backup merged, and ${restored} audio file${restored === 1 ? '' : 's'} restored.`) : t('备份已合并，保留较新的复习记录。', 'Backup merged. The newer review record is kept.'));
      }
      else importCards(raw);
    } catch (error) { if ($('#import-error')) $('#import-error').textContent = error.message; toast(t(`导入失败：${error.message}`, `Import failed: ${error.message}`)); }
    el.value = '';
  }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'card-form') return;
  event.preventDefault();
  const form = event.target;
  const run = async () => {
    const old = cardById(form.dataset.id);
    const file = form.elements.audioFile?.files?.[0];
    const c = { ...old, ...Object.fromEntries(new FormData(form)), id: old?.id || 'custom-' + uniqueId(), origin: old?.origin || '手动录入', tags: old?.tags?.length ? old.tags : ['我的资料'] };
    delete c.audioFile;
    c.fragment = c.fragment === 'true';
    if (c.audioStart === '') delete c.audioStart;
    if (c.audioEnd === '') delete c.audioEnd;
    if (!String(c.focus || '').trim()) c.focus = String(c.sentence || '').trim();
    if (!String(c.target || '').trim()) c.target = c.focus;
    if (c.kind === 'listening' && !form.dataset.clearClip) {
      if (!old?.lessonId) c.selfStudy = true;
      if (file) {
        const saved = await saveClip(file);
        c.audioName = saved.name;
        c.localAudio = { id: saved.id };
      } else if (old?.localAudio) c.localAudio = old.localAudio;
    } else {
      delete c.localAudio; delete c.audioName; delete c.audioStart; delete c.audioEnd;
    }
    const validated = validateCards([c])[0];
    state.cards = [...state.cards.filter(x => x.id !== c.id), validated]; persist(); $('#edit-dialog').close(); render(); toast(t('已保存知识卡', 'Card saved'));
  };
  run().catch(error => { const box = $('#edit-error'); if (box) box.textContent = error.message; });
});
document.addEventListener('loadedmetadata', event => {
  const audio = event.target; if (audio.matches?.('audio[data-segment-start]')) audio.currentTime = Number(audio.dataset.segmentStart);
}, true);
document.addEventListener('play', event => {
  const audio = event.target;
  if (audio.matches?.('audio[data-segment-start]') && (audio.currentTime < Number(audio.dataset.segmentStart) || audio.currentTime >= Number(audio.dataset.segmentEnd))) audio.currentTime = Number(audio.dataset.segmentStart);
}, true);
document.addEventListener('timeupdate', event => {
  const audio = event.target; if (audio.matches?.('audio[data-segment-end]') && audio.currentTime >= Number(audio.dataset.segmentEnd)) audio.pause();
}, true);
document.addEventListener('focusout', () => setTimeout(applyPendingFeed, 200));
document.addEventListener('pointerdown', () => { pointerBusy = true; }, true);
document.addEventListener('pointerup', () => setTimeout(() => { pointerBusy = false; applyPendingFeed(); }, 0), true);
document.addEventListener('pointercancel', () => { pointerBusy = false; applyPendingFeed(); }, true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshPublished(); });
window.addEventListener('online', () => refreshPublished());
$('#card-dialog').addEventListener('close', () => { stopMedia(); if (!session && !$('#edit-dialog').open) render(); });
window.addEventListener('hashchange', () => {
  stopMedia(); session = null; lastRating = null;
  route = ['today', 'practice', 'library', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
  render(); window.scrollTo({ top: 0 }); $('#main').focus({ preventScroll: true });
});
async function updateConnection() {
  let cached = false;
  try { cached = !!(await caches.match(new URL('./data/cards.json', location.href))); } catch { /* Browser may disallow cache access. */ }
  const text = cached ? (navigator.onLine ? t('已准备好离线学习', 'Ready to study offline') : t('离线中 · 继续学习', 'Offline · keep studying')) : (navigator.onLine ? t('在线学习', 'Online') : t('离线缓存尚未就绪', 'Offline cache is not ready'));
  $('#connection-label').textContent = text;
  $('#connection-dot').style.background = cached || navigator.onLine ? '#679d61' : '#b99d5a';
  if ($('#cache-detail')) $('#cache-detail').textContent = cached ? t('网页和学习知识卡已缓存，可以离线打开。语音是否离线可用取决于设备。', 'The page and cards are cached, so you can open them offline. Speech offline depends on the device.') : t('离线缓存尚未就绪。请联网打开完整网页，并使用支持 Service Worker 的 HTTPS 浏览器。', 'The offline cache is not ready. Open the full page online in an HTTPS browser that supports service workers.');
}
window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
window.addEventListener('pagehide', stopMedia);
window.addEventListener('storage', event => {
  if (event.key === STORAGE && event.newValue) {
    try { const incoming = validateBackup(JSON.parse(event.newValue)); state = mergeBackup(state, incoming); applyChrome(); if (!session && !document.querySelector('dialog[open]')) render(); else toast(t('另一个标签页的学习记录已同步。', 'Study records from another tab are synced.')); }
    catch { toast(t('另一个标签页的数据无法读取，请先导出当前备份。', 'Could not read the other tab. Export the current backup first.')); }
  }
});
async function init() {
  let feedStorage; try { feedStorage = localStorage; } catch {}
  feedClient = new FeedClient({ baseUrl: new URL('./', import.meta.url), storage: feedStorage, onUpdate: receiveFeed });
  publishedFeeds = feedClient.feeds;
  try { const raw = localStorage.getItem(STORAGE); if (raw) { rawRecovery = raw; state = validateBackup(JSON.parse(raw)); rawRecovery = null; } }
  catch { canStore = false; storageWarning(t('无法读取原有本地数据，已保留原始数据。请在「资料与设置」下载异常数据或导入有效备份；本次进度请导出保存。', 'The saved data could not be read, so the original copy is kept. Download it from Settings or import a valid backup. Export anything you study this session.')); }
  applyChrome();
  try {
    const response = await fetch('./data/cards.json'); if (!response.ok) throw new Error();
    baseCards = validateCards(await response.json());
    await refreshReadingSpeech();
    const listeningResponse = await fetch('./data/listening.json');
    if (!listeningResponse.ok) throw new Error();
    const initialListening = validateFeed(await listeningResponse.json(), 'listening');
    if (!publishedFeeds.listening || publishedFeeds.listening.revision < initialListening.revision) publishedFeeds.listening = initialListening;
    feedClient.feeds.listening = publishedFeeds.listening;
    baseCards = [...baseCards.filter(c => c.kind === 'reading'), ...initialListening.cards];
    route = ['today', 'practice', 'library', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
    try { await loadClipIndex(); const before = JSON.stringify(state.cards); applyKnownAudio(); if (JSON.stringify(state.cards) !== before) persist(); } catch { /* Audio can be chosen again if this browser blocks storage. */ }
    render();
  } catch { applyChrome(); $('#main').innerHTML = `<div class="empty-state"><h1>${t('知识卡暂时没能打开', 'The cards could not be opened')}</h1><p>${t('请联网后刷新，让学习本完成第一次加载。', 'Refresh while online so the notebook can finish its first load.')}</p></div>`; return; }
  await updateConnection();
  refreshPublished();
  setInterval(() => { if (document.visibilityState === 'visible') refreshPublished(); }, 60000);
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js');
      navigator.serviceWorker.ready.then(updateConnection);
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { updateConnection(); if (reloading) return; if (applyUpdate) { reloading = true; location.reload(); } });
      swRegistration.addEventListener('updatefound', () => { const worker = swRegistration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) toast(t('网页新版本已下载，可在资料与设置中应用更新。', 'A new version is downloaded. Apply it from Settings.')); }); });
    } catch { updateConnection(); }
  }
}
init();

