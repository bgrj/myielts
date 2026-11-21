import { DAY, dayKey, emptyState, schedule, queueFor, checkAnswer, validateCards, validateBackup, mergeBackup } from './core.js';
import { PUBLISHERS, LEARNING_URL, publishedCards, botInstructions } from './publishing.js';
import { FeedClient } from './feed-client.js';

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
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`; }
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const STORAGE = 'myielts.state.v1';
let state = emptyState(), baseCards = [], session = null, lastRating = null, route = 'today';
let filters = { kind: 'all', source: '', search: '', favorite: false, limit: 30 };
let canStore = true, rawRecovery = null, audioURL = null, toastTimer, swRegistration, applyUpdate = false;
let publishedFeeds = {}, pendingFeeds = null, feedClient, feedFailures = {};
let originalPlayer = null, originalRepeatTimer = null;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200); }
function storageWarning(message) { const el = $('#storage-warning'); el.hidden = false; el.textContent = message; }
function persist() {
  state.updatedAt = Date.now();
  if (!canStore) return;
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
  catch { canStore = false; storageWarning('此浏览器暂时无法保存进度。当前会话可以继续，请在「资料与设置」导出备份。'); }
}
function cards() { return publishedCards([...baseCards, ...state.librarySnapshot], publishedFeeds, state.cards); }
function canApplyFeed() {
  return !session && !document.querySelector('dialog[open]') && !document.activeElement?.matches('input,textarea,select') && !(route === 'settings' && $('#import-json')?.value.trim());
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
    if (canApplyFeed()) { publishedFeeds = feeds; pendingFeeds = null; if (route === 'settings' || route === 'practice') updateFeedStatus(); else render(); if (hasNotes) toast('已收到更新的学习内容，复习进度已保留。'); }
    else if (hasNotes) toast('已收到学习内容更新，结束本轮学习或编辑后显示。');
  }
  updateFeedStatus();
}
async function refreshPublished(manual = false) {
  if (!feedClient || (!navigator.onLine && !manual)) return;
  const button = $('[data-action="sync-content"]'); if (button) button.disabled = true;
  const result = await feedClient.refresh();
  const currentButton = $('[data-action="sync-content"]'); if (currentButton) currentButton.disabled = false;
  if (manual) toast(Object.keys(result.failures).length ? '部分内容源暂不可用，已有知识和进度仍保留。' : pendingFeeds ? '已收到更新，结束本轮学习或编辑后显示。' : '已检查最新学习内容。');
}
function updateFeedStatus() {
  for (const kind of Object.keys(PUBLISHERS)) {
    const el = $(`[data-feed-status="${kind}"]`); if (!el) continue;
    const feed = feedClient?.feeds[kind];
    if (feedFailures[kind]) el.textContent = feed ? '暂未连上最新内容，使用已保存版本。' : '等待连上内容源；已有知识卡可以继续学。';
    else if (!feed) el.textContent = '正在连接内容源…';
    else if (!feed.cards.length) el.textContent = '发布通道已就绪 · 等待 bot 首次发布';
    else el.textContent = `${feed.publisher === 'grok' ? 'Bot 已发布' : '反馈资料已核对'} ${feed.cards.length} 条 · 第 ${feed.revision} 版 · ${formatDate(Date.parse(feed.updatedAt), true)}${feedClient.status[kind] === 'cached' ? ' · 离线保存' : ''}`;
  }
}
function syncPanel() {
  return `<section class="panel wide sync-panel"><h2>反馈给 Grok，内容自动到这里</h2><p>按平时的方式反馈生词、追加表达或没听清的片段；bot 整理并发布后，学习、练习和复习会一起更新。</p><div class="sync-sources">${Object.entries(PUBLISHERS).map(([kind, bot]) => `<div><h3>${kind === 'reading' ? icon('book') : icon('headphones')} ${esc(bot.name)}</h3><p class="help-text" data-feed-status="${kind}" role="status">正在检查发布状态…</p><button class="btn btn-secondary" data-action="copy-bot-setup" data-kind="${kind}">复制${kind === 'reading' ? '阅读' : '听力'} bot 配置指令</button></div>`).join('')}</div><p class="help-text">首次只需把配置指令发给对应 bot，并在 Grok 里连接 GitHub、授予 bgrj/myielts 写入权限。这里的“通道就绪”不代表 bot 已完成授权；首次真实发布后会显示发布版本。</p><div class="settings-actions"><button class="btn btn-secondary" data-action="sync-content">检查新反馈</button><a class="text-button" href="https://github.com/bgrj/myielts/blob/main/BOT-PUBLISHING.md" target="_blank" rel="noopener">查看连接说明</a></div><p class="help-text">网页打开时每分钟检查，回到页面时也会检查。正在作答或编辑时，更新留到结束后显示。常用入口：<a class="inline-link" href="${LEARNING_URL}">ourbeings.com/ielts/</a></p></section>`;
}
function cardById(id) { return cards().find(c => c.id === id); }
function formatDate(value, full = false) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', ...(full ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(value);
}
function intervalText(ms) { if (ms < DAY) return `${Math.round(ms / 60000)} 分钟`; const days = Math.round(ms / DAY * 10) / 10; return `${days} 天`; }
function badge(c) { return `<span class="badge ${c.kind}">${icon(c.kind === 'listening' ? 'headphones' : 'book')}${c.kind === 'listening' ? '听力精听' : '阅读积累'}</span>`; }
function favoriteButton(c) { return `<button class="icon-button favorite ${state.favorites.includes(c.id) ? 'is-favorite' : ''}" data-action="favorite" data-id="${esc(c.id)}" aria-label="${state.favorites.includes(c.id) ? '取消收藏' : '收藏'} ${esc(c.target)}" aria-pressed="${state.favorites.includes(c.id)}">${icon('star')}</button>`; }
function highlighted(c, blank = false) {
  const index = c.sentence.toLowerCase().indexOf(c.focus.toLowerCase());
  if (index < 0) return esc(c.sentence);
  return esc(c.sentence.slice(0, index)) + (blank ? '<span class="blank">____</span>' : `<mark>${esc(c.sentence.slice(index, index + c.focus.length))}</mark>`) + esc(c.sentence.slice(index + c.focus.length));
}
function intro(eyebrow, title, subtitle, extra = '') { return `<div class="page-intro"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${extra}</div>`; }
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
  $('#page-label').textContent = ({ today: '今日学习', practice: '随手练习', library: '我的知识库', settings: '资料与设置' })[route];
}
function render() {
  if (pendingFeeds && canApplyFeed()) { publishedFeeds = pendingFeeds; pendingFeeds = null; }
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
  $('#main').innerHTML = `${intro('MAKE ROOM FOR WHAT YOU KNOW', '每一句，都记住一点。', '回到熟悉的剑雅原句，今天也往前走一小步。', `<span class="date-note">${icon('leaf')}每天一点，慢慢记牢</span>`)}
    <section class="hero" aria-label="今日复习计划"><div><span class="eyebrow">YOUR DAILY MOMENT</span><h2>${queue.length ? '把学过的，变成记住的。' : reviewed ? '今天的回忆，已好好收下。' : '从熟悉的一句话开始。'}</h2><p>今天有 ${due} 条到期复习${fresh ? `，再认识 ${fresh} 个旧难点` : ''}。<br>留几分钟给自己，让记忆再清晰一点。</p><div class="hero-actions"><button class="btn btn-lime" data-action="start-review" ${queue.length ? '' : 'disabled'}>${icon('practice')}${queue.length ? '开始今日学习' : '目前没有待学任务'}</button><a class="btn-quiet" href="#library">先随便看看</a></div></div><div class="hero-art" aria-hidden="true"><div class="orbital"></div><div class="orbital second"></div><span class="art-spark">✦</span><div class="paper-stack"><span class="art-text">Aa.</span><span class="art-line"></span><span class="art-line"></span><span class="art-line short"></span><span class="art-check">${icon('check')}</span></div></div></section>
    <div class="stats-grid"><div class="stat"><span class="stat-icon">${icon('check')}</span><div><div class="stat-label">今日已学</div><div class="stat-value">${totalToday()}<span>条知识</span></div></div></div><div class="stat"><span class="stat-icon">${icon('sun')}</span><div><div class="stat-label">连续学习</div><div class="stat-value">${streak()}<span>天</span></div></div></div><div class="stat"><span class="stat-icon">${icon('layers')}</span><div><div class="stat-label">已开始积累</div><div class="stat-value">${reviewed}<span>/ ${all.length} 条</span></div></div></div></div>
    <div class="dashboard-grid"><section><div class="section-heading"><h2>${queue.length ? '今天，从这一句开始' : '再看一句，温故知新'}</h2><a href="#library">查看知识库 ${icon('book')}</a></div>${candidate ? `<article class="recommend-card"><div class="card-topline">${badge(candidate)}<span class="source-short">${esc(candidate.source.replace('剑雅 ', 'CAMBRIDGE '))}</span></div><p class="english" lang="en">${highlighted(candidate)}</p><p class="meaning">${esc(candidate.meaning || candidate.translation || '回到原句，听清那些容易错过的声音。')}</p><div class="card-bottom"><span class="tiny-label">${esc(candidate.target)}</span><button class="text-button dark" data-action="open-card" data-id="${esc(candidate.id)}">展开学习 ${icon('book')}</button></div></article>` : '<div class="panel">添加第一条知识点，开始积累。</div>'}</section>
    <section><div class="section-heading"><h2>接下来的复习节奏</h2><span class="tiny-label">未来 7 天</span></div><div class="week-panel"><p class="week-label">已学知识的到期安排</p><div class="week-chart" role="img" aria-label="${esc(dayCounts.map((n, i) => `${i ? formatDate(now + i * DAY) : '今天'} ${n}条`).join('，'))}">${dayCounts.map((n, i) => `<div class="day-bar"><span class="bar-value">${n}</span><div class="bar-track"><div class="bar-fill" style="height:${Math.max(4, n / max * 80)}px"></div></div><span>${i ? formatDate(now + i * DAY) : '今天'}</span></div>`).join('')}</div><p class="week-footnote">${icon('clock')}${reviewed ? '按每次回忆的难易，调整下次见面。' : '学完第一条，就会有你的复习安排。'}</p></div></section></div>
    <section class="source-section"><div class="section-heading"><h2>我的学习足迹</h2><span class="tiny-label">来自你的学习笔记</span></div><div class="source-grid">${sourceGroups.map(([source, meta]) => `<button class="source-tile" data-action="source" data-source="${esc(source)}"><span class="source-book">${meta.kind === 'listening' ? icon('headphones') : '17'}</span><div><h3>${esc(meta.title || source)}</h3><p>${esc(source)} · ${all.filter(c => c.source === source).length} 条</p></div></button>`).join('')}</div></section>`;
}
function renderLibrary(restoreSearch = false) {
  const all = cards();
  const result = all.filter(c => (filters.kind === 'all' || c.kind === filters.kind) && (!filters.source || c.source === filters.source) && (!filters.favorite || state.favorites.includes(c.id)) && (!filters.search || [c.target, c.meaning, c.sentence, c.translation, c.note, c.source, c.originalRef].join(' ').toLowerCase().includes(filters.search.toLowerCase())));
  $('#main').innerHTML = `${intro('WORDS LIVE IN SENTENCES', '我的知识库', '每个不熟悉的地方，都有原句可以回去。', '<button class="btn btn-secondary" data-action="new-card">' + icon('plus') + ' 记一条</button>')}
    <div class="filter-row"><label class="search"><span class="sr-only">搜索知识点或原句</span>${icon('search')}<input id="library-search" type="search" placeholder="搜单词、原句、中文或笔记…" value="${esc(filters.search)}" autocomplete="off"></label><select id="source-filter" aria-label="按剑雅出处筛选"><option value="">全部出处</option>${[...new Set(all.map(c => c.source))].map(s => `<option value="${esc(s)}" ${s === filters.source ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
    <div class="chips">${[['all', '全部知识'], ['reading', '阅读'], ['listening', '听力']].map(([kind, text]) => `<button class="chip ${filters.kind === kind ? 'active' : ''}" data-action="filter-kind" data-kind="${kind}" aria-pressed="${filters.kind === kind}">${text}</button>`).join('')}<button class="chip ${filters.favorite ? 'active' : ''}" data-action="filter-favorite" aria-pressed="${filters.favorite}">${icon('star')} 我的收藏</button></div>
    <div class="results-meta"><span>共 ${result.length} 条知识点</span><span>在语境中记忆</span></div><div class="library-list">${result.slice(0, filters.limit).map(c => `<article class="library-card"><button class="library-open" data-action="open-card" data-id="${esc(c.id)}"><span class="row-title">${badge(c)}<strong lang="en">${esc(c.target)}</strong></span><span class="muted">${esc(c.meaning || c.translation)}</span><p lang="en">${highlighted(c)}</p><span class="library-meta">${esc(c.source)} · ${state.progress[c.id] ? `下次 ${formatDate(state.progress[c.id].due, true)}` : '尚未开始复习'}</span></button>${favoriteButton(c)}</article>`).join('')}</div>${!result.length ? '<div class="empty-state"><h2>这里还没有匹配的句子</h2><p>换个词搜索，或清除筛选试试。</p></div>' : ''}${result.length > filters.limit ? '<div class="load-more"><button class="btn btn-secondary" data-action="load-more">再看 30 条</button></div>' : ''}`;
  if (restoreSearch) { const input = $('#library-search'); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
}
function renderPractice() {
  $('#main').innerHTML = `${intro('A FEW MINUTES, A LITTLE CLEARER', '换个方式，再记一次。', '自由练习不改变复习安排；想记录进度，请回到今日学习。')}
    <div class="practice-grid">${[
      ['cloze', 'book', '原句填空', '把原句里熟悉又模糊的表达，亲自填回来。', 'reading'],
      ['dictation', 'headphones', '精听听写', '听一句，写一句，找出弱读和连读藏在哪里。', 'listening'],
      ['recall', 'practice', '中英回忆', '先看中文含义，尝试复现表达，再用剑雅原句核对。', 'all'],
    ].map(([mode, ico, title, desc, kind]) => `<button class="practice-tile" data-action="practice" data-mode="${mode}" data-kind="${kind}"><span class="stat-icon">${icon(ico)}</span><h2>${title}</h2><p>${desc}</p><span class="text-button dark">练习 5 条 · 约 3 分钟</span></button>`).join('')}</div>
    <div class="study-note">${icon('leaf')}<span>先回忆，再看答案。记不起来也没关系：找到自己卡住的地方，就是这一次练习的收获。</span></div><section class="panel" style="margin-top:25px"><h2>剑雅原音，逐句精听</h2><p>听力知识卡使用对应的剑雅原录音。你也可以选择本地整段录音，结合原段落回听。</p><label class="btn btn-secondary import-label" style="margin-top:15px">${icon('headphones')} 选择本地录音<input type="file" class="file-input" data-file="audio" accept="audio/*"></label><p class="help-text">音频只在当前设备的本次会话中播放，不上传。使用播放器自行定位到要练习的句子。</p>${audioElement()}</section>`;
}
function audioElement() { return audioURL ? `<audio class="local-audio" controls src="${esc(audioURL)}" aria-label="本地剑雅录音"></audio>` : ''; }
function remoteAudio(c) {
  if (!c.audio) return '';
  return `<div class="detail-block"><h3>对应的剑雅原音片段</h3><audio controls preload="none" class="local-audio" src="${esc(c.audio.url)}#t=${c.audio.start},${c.audio.end}" data-segment-start="${c.audio.start}" data-segment-end="${c.audio.end}" aria-label="剑雅原音片段"></audio><p class="help-text">${esc(c.audioSource || c.source)} · 到片段结尾自动暂停。</p></div>`;
}
function originalControls(c) {
  return `<div class="review-controls"><button class="btn btn-secondary" data-action="original-play" data-id="${esc(c.id)}" ${c.audio ? '' : 'disabled'}>${icon('headphones')} 播放原音</button><button class="btn btn-secondary" data-action="original-triple" data-id="${esc(c.id)}" ${c.audio ? '' : 'disabled'}>原音三遍</button><button class="btn btn-quiet" data-action="original-slow" data-id="${esc(c.id)}" ${c.audio ? '' : 'disabled'}>原音慢速</button><button class="btn btn-quiet" data-action="stop-audio">停止</button></div><p class="audio-notice" data-original-status role="status">${c.audio ? '对应剑雅原录音 · 三遍模式每遍间隔 3 秒' : '原音待补齐，暂不进入听写练习。'}</p>`;
}
function playOriginal(id, repeats = 1, rate = 1) {
  const c = cardById(id); if (!c?.audio) { toast('这条反馈还缺对应原音，请补齐后再练习。'); return; }
  stopMedia();
  const player = new Audio(c.audio.url); originalPlayer = player; player.playbackRate = rate;
  let played = 1, finishedThisPass = false;
  const status = message => document.querySelectorAll('[data-original-status]').forEach(el => el.textContent = message);
  const finished = () => {
    if (finishedThisPass || originalPlayer !== player) return;
    finishedThisPass = true; player.pause();
    if (played < repeats) {
      status(`原音第 ${played}/${repeats} 遍结束，停顿 3 秒…`);
      originalRepeatTimer = setTimeout(() => {
        if (originalPlayer !== player) return;
        played++; finishedThisPass = false; player.currentTime = c.audio.start;
        status(`正在播放原音 · 第 ${played}/${repeats} 遍`);
        player.play().catch(() => status('点击播放原音继续。'));
      }, 3000);
    } else status(`原音播放完成${repeats > 1 ? ' · 共 3 遍' : ''}`);
  };
  player.onloadedmetadata = () => { player.currentTime = c.audio.start; };
  player.ontimeupdate = () => { if (player.currentTime >= c.audio.end) finished(); };
  player.onended = finished;
  player.onerror = () => { stopMedia(); toast('对应原音暂未加载成功，请联网后重试。'); };
  status(`正在播放原音 · 第 1/${repeats} 遍`);
  player.play().catch(() => { status('原音未能开始播放，请再点一次。'); });
}
function publishedOverride(c) {
  const remote = Object.values(publishedFeeds).flatMap(feed => feed.cards).find(card => card.id === c.id);
  if (!remote || !state.cards.some(card => card.id === c.id) || JSON.stringify(remote) === JSON.stringify(c)) return '';
  return `<div class="review-feedback">你保留了这条知识的个人编辑，bot 也提供了更新版本。<button class="text-button dark" data-action="use-published" data-id="${esc(c.id)}">采用 bot 版本，保留复习进度</button></div>`;
}
function details(c) {
  const p = state.progress[c.id];
  return `${publishedOverride(c)}<h3 class="word-heading" lang="en">${esc(c.target)}</h3>${c.ipa ? `<p class="ipa" lang="en">${esc(c.ipa)}</p>` : ''}<p>${esc(c.meaning || '')}</p>
    <div class="detail-block"><h3>剑雅${c.fragment ? '原录音片段' : '原句'} · ${esc(c.source)}</h3><p class="english" lang="en">${highlighted(c)}</p>${c.translation ? `<p class="translation">${esc(c.translation)}</p>` : '<p class="help-text">此句尚未补充整句翻译，可在编辑中补充；上方是知识点释义。</p>'}<p class="help-text">${esc(c.originalRef || '')}</p></div>
    ${[['feedback', '我的反馈'], ['note', '理解这个难点'], ['personalError', '当时没听清的地方'], ['pronunciation', '连读、弱读与发音'], ['grammar', '原句语法'], ['speaker', '原录音说话人'], ['collocations', '固定搭配'], ['related', '联系着记'], ['etymology', '词源线索']].filter(([key]) => c[key]).map(([key, title]) => `<div class="detail-block"><h3>${title}</h3><p>${esc(c[key])}</p></div>`).join('')}
    ${remoteAudio(c)}<div class="detail-block"><h3>复习记录</h3><p>${p ? `已回忆 ${p.reps} 次 · 忘记 ${p.lapses} 次 · 下次 ${formatDate(p.due, true)}` : '还没开始。今日学习会根据每日新学量，逐步把知识点放进复习安排。'}</p><p class="help-text">${esc(c.origin || '手动录入')} · ${c.tags.map(esc).join(' / ')}</p></div>`;
}
function openCard(id) {
  const c = cardById(id); if (!c) return;
  stopMedia();
  const dialog = $('#card-dialog');
  dialog.dataset.cardId = id;
  dialog.innerHTML = `<div class="dialog-header"><div><h2 id="dialog-heading">回到原句里</h2><div style="margin-top:8px">${badge(c)}</div></div><button class="icon-button" data-action="close-dialog" aria-label="关闭知识卡">${icon('close')}</button></div>${details(c)}<div class="dialog-footer">${c.kind === 'listening' ? originalControls(c) : `<button class="btn btn-secondary" data-action="speak" data-id="${esc(id)}">${icon('speaker')} 合成朗读原句</button>`}${favoriteButton(c)}<button class="btn btn-secondary" data-action="edit-card" data-id="${esc(id)}">${icon('edit')} 编辑</button></div><p class="help-text">${c.kind === 'listening' ? '听力使用对应的剑雅原录音，可选原速、慢速及三遍跟练。' : '阅读合成朗读用于辅助跟读。'}</p>`;
  if (!dialog.open) dialog.showModal();
}
function startSession({ practice = false, mode = 'auto', kind = 'all' } = {}) {
  let list = practice ? cards().filter(c => (kind === 'all' || c.kind === kind) && (c.kind !== 'listening' || c.audio)).sort(() => Math.random() - 0.5).slice(0, 5) : queueFor(cards(), state);
  if (!list.length) { toast('目前没有待学内容，可以去知识库看看。'); return; }
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
  $('#main').innerHTML = `<div class="review-top"><div><h2>${session.practice ? '随手练习' : '今日学习'}</h2><p>${session.index + 1} / ${session.ids.length} · ${mode === 'dictation' ? '听一句，写下来' : mode === 'cloze' ? '把原句补完整' : '从中文回到英文'}</p></div><div><button class="btn btn-quiet" data-action="undo" ${lastRating ? '' : 'disabled'}>撤销上一条</button><button class="btn btn-secondary" data-action="exit-session">稍后继续</button></div></div><div class="progress-track"><div class="progress-fill" style="width:${session.index / session.ids.length * 100}%"></div></div>
    <article class="review-card"><div class="card-topline">${badge(c)}<span class="source-short">${esc(c.source)}</span></div>
    ${mode === 'dictation' && !revealing ? `<p class="prompt">先听对应的剑雅原音，再尝试写下句子。</p>${originalControls(c)}${audioElement()}` : ''}
    ${!revealing && mode === 'cloze' ? `<p class="english" lang="en">${highlighted(c, true)}</p><p class="prompt">中文提示：${esc(c.meaning || c.translation)}</p>` : ''}
    ${!revealing && mode === 'recall' ? `<p class="prompt">想想这个表达，在原句里是怎么说的？</p><p class="english">${esc(c.meaning || c.translation || '回想原句中的表达')}</p>` : ''}
    ${!revealing ? `<label for="study-answer" class="sr-only">${mode === 'dictation' ? '写下你听到的句子' : '输入回忆出的表达'}</label><textarea id="study-answer" class="answer-input" placeholder="${mode === 'dictation' ? '写下你听到的，也可以先在心里回忆…' : '试着写下答案，也可以先在心里回忆…'}" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(session.typed)}</textarea><button class="btn reveal" data-action="reveal">回忆好了，核对答案</button><p class="review-explainer">先想一想，比直接看答案更有帮助。</p>` : `
    ${session.typed.trim() ? `<div class="review-feedback ${checkAnswer(session.typed, mode === 'dictation' ? c.sentence : c.focus) ? '' : 'partial'}">${checkAnswer(session.typed, mode === 'dictation' ? c.sentence : c.focus) ? '文字核对一致，看看是否也理解了原句。' : `对照看看：${esc(mode === 'dictation' ? c.sentence : c.focus)}。意思相近的答案，请结合原句自行判断。`}<br><span class="tiny-label">你的答案：${esc(session.typed)}</span></div>` : ''}${details(c)}
    ${c.kind === 'listening' ? originalControls(c) : `<div class="review-controls"><button class="btn btn-secondary" data-action="speak" data-id="${esc(c.id)}">${icon('speaker')} 合成朗读</button></div>`}<div class="review-controls"><button class="btn btn-secondary" data-action="open-card" data-id="${esc(c.id)}">${icon('edit')} 查看 / 补充</button></div>
    ${session.practice ? '<button class="btn reveal" data-action="next-practice">继续练习</button><p class="review-explainer">自由练习不会改变复习安排。</p>' : `<p class="prompt">刚才回忆起来，有多容易？</p><div class="rating-grid">${[['again', '忘了'], ['hard', '吃力'], ['good', '记住'], ['easy', '轻松']].map(([rating, label]) => `<button class="rating" data-action="rate" data-rating="${rating}"><strong>${label}</strong><span>${intervalText(schedule(state.progress[c.id], rating).due - Date.now())}后</span></button>`).join('')}</div><p class="review-explainer">如实反馈，下次复习会按你的状态安排。</p>`}`}</article>`;
}
function renderDone() {
  const next = cards().map(c => state.progress[c.id]?.due).filter(t => t > Date.now()).sort((a, b) => a - b)[0];
  $('#main').innerHTML = `<section class="panel review-done"><span class="stat-icon">${icon('check')}</span><span class="eyebrow">ONE SMALL STEP, WELL TAKEN</span><h1>这几句，又熟悉了一点。</h1><p>本轮完成 ${session.ids.length} 条${session.practice ? '自由练习' : '学习'}。${!session.practice && next ? `下次到期时间：${formatDate(next, true)}。` : '给记忆留一点消化的时间。'}</p><button class="btn" data-action="exit-session">回到学习本</button>${lastRating ? '<button class="btn btn-quiet" data-action="undo">撤销上一条</button>' : ''}</section>`;
}
function rate(rating) {
  if (!session?.revealed || session.practice) return;
  stopMedia();
  const id = session.ids[session.index], now = Date.now();
  lastRating = { id, previous: state.progress[id] ? structuredClone(state.progress[id]) : null, index: session.index, eventId: crypto.randomUUID() };
  const isNew = !state.progress[id];
  state.progress[id] = schedule(state.progress[id], rating, now);
  state.events.push({ id: lastRating.eventId, cardId: id, at: now, day: dayKey(now), rating, isNew });
  persist(); session.index++; session.revealed = false; session.typed = ''; refreshNav(); renderSession(); window.scrollTo({ top: 0 });
}
function undoRating() {
  if (!lastRating || !session) return;
  if (lastRating.previous) state.progress[lastRating.id] = lastRating.previous; else delete state.progress[lastRating.id];
  state.events = state.events.filter(e => e.id !== lastRating.eventId);
  session.index = lastRating.index; session.revealed = true; session.typed = ''; lastRating = null; persist(); render(); toast('已撤销上一条评分');
}
const template = { schemaVersion: 1, cards: [{ id: 'c17-t1-p1-congested', kind: 'reading', target: 'congested', meaning: '拥挤的；堵塞的', sentence: 'In the first half of the 1800s, London’s population grew at an astonishing rate, and the central area became increasingly congested.', focus: 'congested', source: '剑雅 17 · Test 1 · Passage 1', title: '伦敦地下铁路的发展', translation: '19世纪上半叶，伦敦人口以惊人的速度增长，市中心变得越来越拥挤。', ipa: '/kənˈdʒestɪd/', note: 'become increasingly + 形容词：变得越来越……', collocations: 'become increasingly congested', personalError: '', tags: ['词汇', '搭配'] }] };
const grokPrompt = `请只整理我在本次对话反馈过的不熟悉内容，不要额外推荐新词。每条必须配真实剑雅原句或原录音片段及书册、Test、Passage/Section 出处。不要把改写句冒充原句；无法核实的句子先不要输出。请按以下 JSON 格式输出，可直接复制保存为 .json 导入 MyIELTS。kind 用 reading 或 listening；id 要稳定且唯一，focus 必须原样出现在 sentence 中。提供中文释义、整句翻译、根据我的难点补发音/音标、语法、搭配与易错解释；没有依据的词源不要编写。仅输出 JSON，不含 Markdown 代码围栏。\n\n${JSON.stringify(template, null, 2)}`;
function renderSettings() {
  $('#main').innerHTML = `${intro('MAKE IT YOUR OWN', '让学习本，跟着你成长。', '记录新的难点，也给已经积累的内容留一份备份。')}
    <div class="settings-grid">${syncPanel()}<section class="panel"><h2>按自己的节奏来</h2><p>先复习旧知识，再少量加入新内容。</p><div class="settings-row"><label for="daily-new">每日新学上限</label><input id="daily-new" type="number" min="0" max="30" step="1" value="${state.settings.dailyNew}"></div><div class="settings-row"><label for="speech-rate">合成语音速度</label><select id="speech-rate">${[[0.65,'慢速'],[0.85,'舒缓'],[1,'正常'],[1.15,'稍快']].map(([n,l]) => `<option value="${n}" ${Math.abs(state.settings.rate-n)<.01?'selected':''}>${l}</option>`).join('')}</select></div><p class="help-text">每日统计按北京时间计算。已到期的复习不受新学上限影响。</p></section>
    <section class="panel"><h2>备份你的积累</h2><p>知识卡、收藏和复习进度保存在当前浏览器，不会自动同步到其他设备。</p><div class="settings-actions"><button class="btn btn-secondary" data-action="export">${icon('download')} 导出完整备份</button><label class="btn btn-secondary import-label">合并恢复<input class="file-input" data-file="backup" type="file" accept=".json,application/json"></label></div><p class="help-text">换手机前先导出，再到新设备恢复。恢复会保留较新的复习进度和双方收藏。建议定期备份。</p>${rawRecovery ? '<button class="text-button" data-action="export-raw">下载原始异常数据以便恢复</button>' : ''}</section>
    <section class="panel wide"><h2>手动导入（备用）</h2><p>已有的 JSON 文件也可以手动导入。日常反馈使用上方的 bot 自动发布流程。</p><div class="settings-actions"><a class="btn btn-secondary" href="https://x.ai/bot/rCEjuGhF-TVFft_2pDkqB" target="_blank" rel="noopener">${icon('book')} 打开阅读 Grok</a><a class="btn btn-secondary" href="https://x.ai/bot/_m-HdAjjmGuyPPJH1ASnm" target="_blank" rel="noopener">${icon('headphones')} 打开听力 Grok</a><button class="btn btn-secondary" data-action="copy-prompt">复制整理指令</button><button class="btn btn-secondary" data-action="download-template">下载 JSON 示例</button></div><p class="help-text">这两个链接用于打开 bot，本站无法读取私人聊天。只导入你明确整理的学习记录。</p><details style="margin-top:15px"><summary class="text-button">查看整理指令与格式</summary><pre class="template">${esc(grokPrompt)}</pre></details><label class="form-field" style="margin-top:16px" for="import-json">粘贴 Grok 输出的 JSON<textarea id="import-json" rows="5" placeholder='{"schemaVersion":1,"cards":[...]}'></textarea></label><div class="settings-actions"><button class="btn" data-action="import-paste">导入知识卡</button><label class="btn btn-secondary import-label">选择 JSON 文件<input class="file-input" data-file="cards" type="file" accept=".json,application/json"></label><button class="btn btn-secondary" data-action="new-card">${icon('plus')} 手动记一条</button></div><p id="import-error" class="error-text" role="alert"></p><p class="help-text">导入前会检查所有条目，有错误时整批不写入。同一 id 更新内容，但保留已有复习进度。</p></section>
    <section class="panel"><h2>为什么这样安排复习？</h2><p>先回忆、再核对。用 1、3、7、14、30、60、120 天作初始阶梯，按照“忘了 / 吃力 / 记住 / 轻松”调整。</p><p style="margin-top:10px">忘记后 10 分钟重学；吃力时缩短间隔；记住后逐步拉开；轻松时跳过一阶。固定天数只是起点，不代表个人记忆的精确预测。</p><a class="inline-link help-text" href="https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html" target="_blank" rel="noopener">主动提取与分散练习的研究依据</a></section>
    <section class="panel"><h2>手机随时打开</h2><p>首次联网打开后，网页和知识卡会缓存在设备上。可用浏览器菜单“添加到主屏幕”。</p><p class="help-text" id="cache-detail">正在检查离线缓存…</p><div class="settings-actions"><button class="btn btn-secondary" data-action="update">检查网页更新</button><a class="btn btn-secondary" href="https://github.com/bgrj/myielts" target="_blank" rel="noopener">GitHub 仓库</a></div><p class="help-text">个人学习资料不因 GitHub 更新而上传。清理浏览器网站数据会清除本地进度，请先备份。</p></section></div>`;
  updateConnection(); updateFeedStatus();
}
function editCard(id) {
  const c = id ? cardById(id) : null;
  $('#card-dialog').close();
  const fields = [['target','知识点 / 不熟悉的表达',true],['meaning','中文释义',false],['source','剑雅出处（书册 / Test / Passage 或 Section）',true],['focus','原句中用于填空的原样片段',true],['sentence','剑雅原句 / 原录音片段',true],['translation','整句中文翻译',false],['ipa','音标',false],['title','篇章 / 场景名称',false],['note','语法、发音与难点解释',false],['collocations','固定搭配',false],['personalError','自己的错误 / 疑问',false],['etymology','有依据的词源（可选）',false]];
  $('#edit-dialog').innerHTML = `<div class="dialog-header"><h2 id="edit-heading">${c ? '补充这条知识' : '记下一个难点'}</h2><button class="icon-button" data-action="close-dialog" aria-label="关闭编辑">${icon('close')}</button></div><form id="card-form" data-id="${esc(id || '')}"><div class="form-grid"><label class="form-field">学习类型<select name="kind"><option value="reading">阅读</option><option value="listening" ${c?.kind==='listening'?'selected':''}>听力</option></select></label><label class="form-field">原句形式<select name="fragment"><option value="false">完整原句</option><option value="true" ${c?.fragment?'selected':''}>原录音 / 原文片段</option></select></label>${fields.map(([key,label,required]) => `<label class="form-field ${['sentence','translation','note','personalError','etymology'].includes(key)?'wide':''}">${label}${required?' *':''}${['sentence','translation','note','personalError','etymology'].includes(key)?`<textarea name="${key}" ${required?'required':''} maxlength="12000">${esc(c?.[key] || '')}</textarea>`:`<input name="${key}" value="${esc(c?.[key] || '')}" ${required?'required':''} maxlength="12000">`}</label>`).join('')}</div><p id="edit-error" class="error-text" role="alert"></p><p class="help-text">原句和出处请与手头剑雅材料核对。保存内容不会重置复习排期。</p><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="close-dialog">取消</button><button class="btn" type="submit">保存知识卡</button></div></form>`;
  $('#edit-dialog').showModal();
}
function importCards(data) {
  if (data.schemaVersion !== 1) throw new Error('需要 schemaVersion: 1 的知识卡 JSON');
  const incoming = validateCards(data.cards);
  if (!incoming.length) throw new Error('没有可导入的知识卡');
  state.cards = [...new Map([...state.cards, ...incoming].map(c => [c.id, c])).values()];
  persist(); toast(`已导入 ${incoming.length} 条，已有复习进度已保留。`); render();
}
function download(data, filename, isRaw = false) {
  const url = URL.createObjectURL(new Blob([isRaw ? data : JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function speak(id, slow = false) {
  const originalCard = cardById(id); if (originalCard?.kind === 'listening') { playOriginal(id, 1, slow ? .8 : 1); return; }
  if (!('speechSynthesis' in window)) { toast('此浏览器不支持合成朗读，请使用本地原录音。'); return; }
  const c = cardById(id); if (!c) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(c.sentence);
  utterance.lang = 'en-GB'; utterance.rate = slow ? 0.65 : state.settings.rate;
  const voice = speechSynthesis.getVoices().find(v => v.lang === 'en-GB') || speechSynthesis.getVoices().find(v => v.lang.startsWith('en'));
  if (voice) utterance.voice = voice;
  utterance.onerror = () => toast('语音暂不可用，试试联网或播放本地原录音。');
  speechSynthesis.speak(utterance);
}
function stopMedia() { clearTimeout(originalRepeatTimer); originalRepeatTimer = null; if (originalPlayer) { originalPlayer.pause(); originalPlayer = null; } window.speechSynthesis?.cancel(); document.querySelectorAll('audio').forEach(a => a.pause()); }
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (action === 'start-review') startSession();
  if (action === 'sync-content') refreshPublished(true);
  if (action === 'copy-bot-setup') {
    const instruction = botInstructions(button.dataset.kind);
    try { await navigator.clipboard.writeText(instruction); toast('配置指令已复制，发给对应 bot 一次即可。'); }
    catch { const dialog = $('#card-dialog'); dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-heading">Bot 配置指令</h2><button class="icon-button" data-action="close-dialog" aria-label="关闭配置指令">${icon('close')}</button></div><pre class="template">${esc(instruction)}</pre>`; dialog.showModal(); }
  }
  if (action === 'use-published') { state.cards = state.cards.filter(c => c.id !== id); persist(); openCard(id); toast('已采用 bot 版本，复习进度已保留。'); }
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
  if (action === 'speak' || action === 'speak-slow') speak(id, action === 'speak-slow');
  if (action === 'original-play') playOriginal(id);
  if (action === 'original-triple') playOriginal(id, 3);
  if (action === 'original-slow') playOriginal(id, 1, .8);
  if (action === 'stop-audio') { stopMedia(); toast('原音已停止'); }
  if (action === 'export') download({ ...state, cards: cards(), localCardIds: state.cards.map(c => c.id) }, `myielts-backup-${dayKey()}.json`);
  if (action === 'export-raw') download(rawRecovery, 'myielts-recovery.json', true);
  if (action === 'download-template') download(template, 'myielts-grok-template.json');
  if (action === 'copy-prompt') {
    try { await navigator.clipboard.writeText(grokPrompt); toast('整理指令已复制，粘贴给 Grok 即可。'); }
    catch { const details = $('details'); if (details) details.open = true; toast('请展开指令后手动复制。'); }
  }
  if (action === 'import-paste') {
    try { importCards(JSON.parse($('#import-json').value)); }
    catch (error) { $('#import-error').textContent = error instanceof SyntaxError ? 'JSON 格式不正确，请只粘贴 JSON，不含代码围栏。' : error.message; }
  }
  if (action === 'update') {
    if (!swRegistration) { toast('离线服务暂不可用，请联网刷新网页。'); return; }
    try { await swRegistration.update(); if (swRegistration.waiting) { applyUpdate = true; swRegistration.waiting.postMessage('SKIP_WAITING'); } else toast('已检查更新。若有新版本，下载完成后再次点击即可应用。'); }
    catch { toast('检查更新失败，联网后再试。'); }
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'library-search') { filters.search = event.target.value; filters.limit = 30; renderLibrary(true); }
  if (event.target.id === 'study-answer' && session) session.typed = event.target.value;
});
document.addEventListener('change', async event => {
  const el = event.target;
  if (el.id === 'source-filter') { filters.source = el.value; filters.limit = 30; renderLibrary(); }
  if (el.id === 'daily-new') { const n = Number(el.value); if (el.value !== '' && Number.isInteger(n) && n >= 0 && n <= 30) { state.settings.dailyNew = n; persist(); toast('每日新学量已保存'); } else { el.value = state.settings.dailyNew; toast('请填写 0 到 30 的整数'); } }
  if (el.id === 'speech-rate') { state.settings.rate = Number(el.value); persist(); }
  if (el.dataset.file && el.files?.[0]) {
    const file = el.files[0];
    if (el.dataset.file === 'audio') {
      if (audioURL) URL.revokeObjectURL(audioURL); audioURL = URL.createObjectURL(file); render(); toast('本地录音已选择，只在本次会话使用。'); return;
    }
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('JSON 文件超过 20 MB，请分批导入');
      const data = JSON.parse(await file.text());
      if (el.dataset.file === 'backup') { state = mergeBackup(state, data); canStore = true; persist(); if (canStore) $('#storage-warning').hidden = true; render(); toast('备份已合并，保留较新的复习记录。'); }
      else importCards(data);
    } catch (error) { if ($('#import-error')) $('#import-error').textContent = error.message; toast(`导入失败：${error.message}`); }
    el.value = '';
  }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'card-form') return;
  event.preventDefault();
  try {
    const form = event.target, old = cardById(form.dataset.id);
    const c = { ...old, ...Object.fromEntries(new FormData(form)), id: old?.id || 'custom-' + crypto.randomUUID(), origin: old?.origin || '手动录入', tags: old?.tags || [] };
    c.fragment = c.fragment === 'true';
    const validated = validateCards([c])[0];
    state.cards = [...state.cards.filter(x => x.id !== c.id), validated]; persist(); $('#edit-dialog').close(); render(); toast('已保存知识卡');
  } catch (error) { $('#edit-error').textContent = error.message; }
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
document.addEventListener('focusout', () => setTimeout(applyPendingFeed, 0));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshPublished(); });
window.addEventListener('online', () => refreshPublished());
$('#quick-add').addEventListener('click', () => editCard());
$('#card-dialog').addEventListener('close', () => { stopMedia(); if (!session && !$('#edit-dialog').open) render(); });
window.addEventListener('hashchange', () => {
  stopMedia(); session = null; lastRating = null;
  route = ['today', 'practice', 'library', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
  render(); window.scrollTo({ top: 0 }); $('#main').focus({ preventScroll: true });
});
async function updateConnection() {
  let cached = false;
  try { cached = !!(await caches.match(new URL('./data/cards.json', location.href))); } catch { /* Browser may disallow cache access. */ }
  const text = cached ? (navigator.onLine ? '已准备好离线学习' : '离线中 · 继续学习') : (navigator.onLine ? '在线学习' : '离线缓存尚未就绪');
  $('#connection-label').textContent = text;
  $('#connection-dot').style.background = cached || navigator.onLine ? '#679d61' : '#b99d5a';
  if ($('#cache-detail')) $('#cache-detail').textContent = cached ? '网页和学习知识卡已缓存，可以离线打开。语音是否离线可用取决于设备。' : '离线缓存尚未就绪。请联网打开完整网页，并使用支持 Service Worker 的 HTTPS 浏览器。';
}
window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
window.addEventListener('pagehide', stopMedia);
window.addEventListener('storage', event => {
  if (event.key === STORAGE && event.newValue) {
    try { const incoming = validateBackup(JSON.parse(event.newValue)); state = mergeBackup(state, incoming); if (!session && !document.querySelector('dialog[open]')) render(); else toast('另一个标签页的学习记录已同步。'); }
    catch { toast('另一个标签页的数据无法读取，请先导出当前备份。'); }
  }
});
async function init() {
  let feedStorage; try { feedStorage = localStorage; } catch {}
  feedClient = new FeedClient({ baseUrl: new URL('./', import.meta.url), storage: feedStorage, onUpdate: receiveFeed });
  publishedFeeds = feedClient.feeds;
  try { const raw = localStorage.getItem(STORAGE); if (raw) { rawRecovery = raw; state = validateBackup(JSON.parse(raw)); rawRecovery = null; } }
  catch { canStore = false; storageWarning('无法读取原有本地数据，已保留原始数据。请在「资料与设置」下载异常数据或导入有效备份；本次进度请导出保存。'); }
  try {
    const response = await fetch('./data/cards.json'); if (!response.ok) throw new Error();
    baseCards = validateCards(await response.json());
    route = ['today', 'practice', 'library', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
    $('#today-date').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(Date.now());
    render();
  } catch { $('#main').innerHTML = '<div class="empty-state"><h1>知识卡暂时没能打开</h1><p>请联网后刷新，让学习本完成第一次加载。</p></div>'; return; }
  await updateConnection();
  refreshPublished();
  setInterval(() => { if (document.visibilityState === 'visible') refreshPublished(); }, 60000);
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js');
      navigator.serviceWorker.ready.then(updateConnection);
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { updateConnection(); if (reloading) return; if (applyUpdate) { reloading = true; location.reload(); } });
      swRegistration.addEventListener('updatefound', () => { const worker = swRegistration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) toast('网页新版本已下载，可在资料与设置中应用更新。'); }); });
    } catch { updateConnection(); }
  }
}
init();
