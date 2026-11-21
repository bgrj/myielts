import { validateCards, normalizeAnswer } from './core.js';
import { validateLessons } from './listening.js';

export const PUBLISHERS = {
  reading: { botId: '0eca5200-224b-4af8-b13a-6fd4f4762592', name: '雅思全套阅读练习指导大师', path: 'content/reading.json' },
  listening: { botId: 'e79fc4f8-184b-450b-b10e-a21f91070599', name: '十年雅思听力指导大师', path: 'content/listening.json' },
};
export const LEARNING_URL = 'https://ourbeings.com/ielts/';
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

export function validateFeed(data, kind) {
  if (!PUBLISHERS[kind] || !plain(data) || data.schemaVersion !== 1 || data.kind !== kind || data.botId !== PUBLISHERS[kind].botId) throw new Error('发布源、版本或 bot 身份不匹配');
  if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error('发布 revision 必须是非负整数');
  if (typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error('发布时间无效');
  if (!['initialization', 'grok', 'verified-feedback'].includes(data.publisher)) throw new Error('发布者标记无效');
  const cards = validateCards(data.cards);
  for (const card of cards) {
    if (card.kind !== kind) throw new Error('阅读和听力必须写入各自的内容源');
    if (!card.originalRef || !card.translation || !card.note || (kind === 'reading' && !card.feedback)) throw new Error(`${card.id} 缺少原句出处、译文、解释或阅读反馈`);
    if (!card.sourceVerified) throw new Error(`${card.id} 的剑雅原句尚未核对`);
    if (kind === 'listening' && (!card.audio || !card.audioSource)) throw new Error(`${card.id} 缺少对应的剑雅原音及来源，需补齐后再发布听力练习`);
    if (kind === 'listening' && (!card.lessonId || !card.order || !card.speaker)) throw new Error('听力需发布完整原声课程，包含说话人和句序');
    if (card.origin === '演示' || card.id.startsWith('qa-')) throw new Error('测试内容不能发布到学习源');
  }
  return { schemaVersion: 1, kind, botId: PUBLISHERS[kind].botId, revision: data.revision, updatedAt: new Date(data.updatedAt).toISOString(), publisher: data.publisher, ...(kind === 'listening' ? { lessons: validateLessons(data.lessons, cards) } : {}), cards };
}

export function acceptFeed(previous, incoming, kind) {
  const next = validateFeed(incoming, kind);
  if (previous && next.revision < previous.revision) throw new Error('收到较旧的内容版本，保留现有知识卡');
  if (previous && next.revision === previous.revision && JSON.stringify(next) !== JSON.stringify(previous)) throw new Error('内容变化需要递增 revision');
  return next;
}

export function publishedCards(base, feeds, local = []) {
  const merged = new Map();
  const add = c => {
    const previous = merged.get(c.id);
    if (!c.audio && previous?.audio && normalizeAnswer(c.sentence) === normalizeAnswer(previous.sentence)) merged.set(c.id, { ...c, audio: previous.audio, audioSource: previous.audioSource });
    else merged.set(c.id, c);
  };
  base.forEach(add);
  for (const kind of Object.keys(PUBLISHERS)) for (const c of feeds[kind]?.cards || []) add(c);
  local.forEach(add);
  return [...merged.values()].filter(c => c.kind !== 'listening' || c.lessonId);
}

export function preparePublication(existing, batch, base = [], now = new Date().toISOString()) {
  const kind = batch?.kind;
  if (!PUBLISHERS[kind] || batch.schemaVersion !== 1 || batch.botId !== PUBLISHERS[kind].botId) throw new Error('请指定有效 kind、botId 和 schemaVersion');
  const previous = validateFeed(existing, kind);
  const incoming = validateCards(batch.cards);
  if (!incoming.length) throw new Error('这次没有要发布的反馈');
  const known = publishedCards(base, { [kind]: previous });
  for (const c of incoming) {
    const sameId = known.find(old => old.id === c.id);
    if (sameId && sameId.kind !== kind) throw new Error('不能把其他类型知识卡改为当前类型');
    const duplicate = kind === 'reading' && known.find(old => old.kind === kind && old.id !== c.id && normalizeAnswer(old.source) === normalizeAnswer(c.source) && normalizeAnswer(old.target) === normalizeAnswer(c.target));
    if (duplicate) throw new Error(`同一知识点已存在，请沿用 id: ${duplicate.id}`);
  }
  const cards = [...new Map([...previous.cards, ...incoming].map(c => [c.id, c])).values()];
  return validateFeed({ ...previous, ...(kind === 'listening' && batch.lessons ? {lessons:batch.lessons} : {}), revision: previous.revision + 1, updatedAt: now, publisher: 'grok', cards }, kind);
}

export function botInstructions(kind) {
  const bot = PUBLISHERS[kind];
  if (kind === 'listening') return `请把以下规则更新到我的听力 bot 长期记忆，替换之前“只练我反馈的38个难片段”的规则。
你的 botId：${bot.botId}。学习网页：${LEARNING_URL}；仓库：https://github.com/bgrj/myielts ，分支 main。GitHub 已连接且有写权限。
先读取 BOT-PUBLISHING.md、content/schema.json、content/listening.json、content/listening-source-transcripts.json、content/listening-audio-manifest.json 和 MATERIALS.md。Git LFS 真题必须读取实际文件，不能把指针当录音或教材。
听力课程以对应完整原声为基础，按录音先后逐句听写、核对、练习和间隔复习，绝不是只抽取我反馈的不熟悉片段。ANNOUNCER 播音员的声音全部属于学习范围：出版/开场说明、考试规则、读题提示、示例说明、正式材料、段间提示、结束和检查答案提示，都不能因为不是人物对话而删掉。示例和正式录音中重复出现的句子按各自位置保留不同稳定 id；自然完整句为单位，保留原声中的真实短答与未说完的句子，不自行补写。
目前网页只开放两个完整场景：self-drive 自驾游预订（剑雅10 Test1 Section1），leisure-club 健身俱乐部（剑雅10 Test1 Section2）。不要推荐、准备发布或自动加入第三部分。等我把这两部分练习、复习完一轮，并明确向你要求第三个场景时，才整理并发布第三部分；其课程 release 为 user-request，releaseNote 记录我的明确要求。不要仅凭时间过去或网页完成听写就推定我同意推进。
我之后反馈听错、漏听、连读、弱读、缩写、重音、虚词、音标、语法疑问时，定位现有课程的稳定句子 id，在该句补充 feedback / personalError / pronunciation / ipa / grammar / note / collocations 等解释；保留完整课程所有句子、原句顺序、播音员、翻译、原声与 id。补充说明不能把完整课程缩减成反馈片段集，也不要重复建卡。
每句必须配对应剑雅原声音频及中文整句翻译、说话人 speaker、lessonId、连续 order、精确出处 originalRef 和音频来源 audioSource。原句对照原录音与材料后才标 sourceVerified:true，不能用 TTS、合成声音、改写句或凭空猜测替代。优先复用 content/listening-audio-manifest.json 的现有逐句 MP3；修订片段需保留完整词头词尾，先上传带哈希文件名的真实 MP3 到 content/audio/，更新清单，再发布内容。每句音频不内嵌重复；网页提供原速、慢速、三遍且间隔3秒。缺原声或待核实的新增课程保留草稿，不声称上线。
发布前读取最新 content/listening.json，合并说明并保持全部原句和 lessons 清单，revision 加1、updatedAt 写真实时间。优先使用已登录的 scripts/publish-feedback.mjs 校验后发布增量；也可用已授权 GitHub app 按同样校验和 SHA 冲突重读规则更新。课程 sentenceCount、announcerCount 必须与真实句子对应，order 从1连续；阅读内容不能修改。
这条规则授权你将我的听力反馈整理成上述句子讲解并直接发布到 content/listening.json，以及必要的原声文件和来源清单；不用让我复制 JSON。不要改网页代码、整套母版资料或另一 bot 的内容，不上传整段私人聊天及凭据。若 Grok 当前仍弹出权限确认卡，请说明具体一步，不要问我要明文 token，不能虚称已发布。
网页会按 10分钟重学以及1、3、7、14、30、60、120天阶梯，结合每句的忘了/吃力/记住/轻松评分安排复习。学习进度在我的浏览器，你不能凭聊天猜测完成状态。需要推进课程时以我的明确要求为准。
发布后读取 ${LEARNING_URL}feeds/listening.json，核对 revision、更新句子 id、两课程完整句序与播音员句数，回复真实提交链接、更新数和网页地址。失败则保留待发布内容并说明原因。首次先核对现有两个完整场景和规则，保存记忆即可；不要额外推送新场景。`;
  return `请为我启用“反馈后更新 MyIELTS”并保存为长期工作规则。你负责${kind === 'reading' ? '阅读' : '听力'}，botId 是 ${bot.botId}。
学习网址：${LEARNING_URL}
源码与内容仓库：https://github.com/bgrj/myielts ，分支 main。
阅读自然朗读已使用预生成的 en-GB-SoniaNeural 英音 MP3，音色尽量自然流畅，和听力真题原声严格区分。你只需更新阅读 JSON；新增原句后仓库的 reading-speech 工作流会自动补齐自然朗读并更新 content/reading-audio-manifest.json，网页自动获取。生成中或失败时仍保留原句和学习进度，不能把合成音说成真题原声；请报告朗读待补齐，勿声称已经生成。
先读取仓库 BOT-PUBLISHING.md、content/schema.json 与 MATERIALS.md / MATERIALS.json。真题、解析和原声音频已按原目录存放，Git LFS 文件要读取实际内容，不能把指针当原文或音频。按本次练习的书册/Test/Passage/Section 获取需要的材料即可。GitHub 已连接且有本仓库写权限；若登录失效，请展示连接卡让我完成授权，不要向我要明文 token。
以后我像往常一样反馈生词、搭配、语法疑问、没听清的片段、听错的词，或说“再加几个”，你整理完成后直接发布到 ${bot.path}，不用让我复制 JSON 或手动导入网页。只有从我反馈中提取的知识点可以进入学习源；未经我反馈的陌生内容不要扩充。
每条保存我的原始难点反馈 feedback、真实剑雅原句/录音片段、精确出处、整句译文及针对性解释；原句与材料核对后才标 sourceVerified:true。不要把改写句或猜测的原文当真题原句。${kind === 'listening' ? '每条听力练习必须使用对应的剑雅原声音频，绝不能用 TTS 或合成语音替代。保留播音员/说话人、连读/弱读/缩写/音标和误听；必须附原音 URL、audioSource 与 start/end 秒数，严格按我指定的片段，不补整段。先查 content/audio-manifest.json 复用已有38句原音；新片段从真实录音裁剪，带哈希文件名上传 content/audio/ 后再发布JSON，更新音频来源清单。缺原音的反馈先保留待补齐，不发布为可练习内容。三遍跟练由网页按每遍间隔3秒播放，不用把重复音嵌进单句文件。' : '追加词汇补入同一篇；同一知识点沿用稳定 id，补充 just、acoustics、salt depot 等疑问时保留原有解释并纠正无依据推断。'}
发布前读取最新内容和 web/data/cards.json，沿用已有 id，合并旧条目，revision 加 1，写入真实 updatedAt。优先在安全的已有 GitHub 登录下运行 scripts/publish-feedback.mjs 校验并发布；使用 GitHub app 写文件时也必须遵循同样校验和 SHA 冲突重读规则。只改你负责的 content 文件${kind === 'listening' ? '、必要的 content/audio/ 新原音片段和音频清单' : ''}，不改网页代码、母版真题或另一 bot 的内容。不要自动推进下一篇或加入我没有反馈的陌生内容。
我的这条规则授权你发布我反馈后的这些学习笔记${kind === 'listening' ? '及对应原音片段' : ''}到此公开仓库，发布范围限上述文件。不要发布整段私人对话或凭据，也不要重复上传整套真题。若当前 Grok 的安全设置仍要求确认，清楚告诉我需要处理的具体一步，不能虚称已发布。
发布后从线上读取对应 /feeds/${kind}.json，核对 revision 和条目 id，再回复提交链接、更新的知识点数和学习网址。若失败保留待发布内容并说明原因，不声称已同步。
先按我已经反馈并核实的内容完成一次真实发布，验证后把这个流程保存为技能；今后在每次反馈整理完成后使用。`;
}
