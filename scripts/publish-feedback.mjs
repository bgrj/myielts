import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preparePublication, PUBLISHERS } from '../web/publishing.js';

const args = process.argv.slice(2);
const input = args[args.indexOf('--input') + 1];
const checkOnly = args.includes('--check');
if (!args.includes('--input') || !input || input.startsWith('--')) throw new Error('Usage: node scripts/publish-feedback.mjs --input /path/to/feedback.json [--check]');
const batch = JSON.parse(await readFile(input, 'utf8'));
const bot = PUBLISHERS[batch.kind];
if (!bot) throw new Error('kind must be reading or listening');
const base = JSON.parse(await readFile(fileURLToPath(new URL('../web/data/cards.json', import.meta.url)), 'utf8'));
function gh(argv, payload) {
  const result = spawnSync('gh', argv, { encoding: 'utf8', input: payload && JSON.stringify(payload), maxBuffer: 20 * 1024 * 1024, shell: false });
  if (result.error) throw new Error('GitHub CLI 未安装；请使用已连接的 GitHub app，按 BOT-PUBLISHING.md 发布。');
  if (result.status !== 0) { const error = new Error(result.stderr?.trim() || 'GitHub request failed'); error.conflict = /409|422|does not match|sha.*match/i.test(error.message); throw error; }
  return JSON.parse(result.stdout);
}
const endpoint = `repos/bgrj/myielts/contents/${bot.path}`;
for (let attempt = 0; attempt < 3; attempt++) {
  const current = checkOnly ? { content: Buffer.from(await readFile(fileURLToPath(new URL('../' + bot.path, import.meta.url)))).toString('base64') } : gh(['api', endpoint + '?ref=main']);
  const existing = JSON.parse(Buffer.from(current.content, 'base64').toString('utf8'));
  const feed = preparePublication(existing, batch, base);
  if (checkOnly) { console.log(JSON.stringify({ valid: true, path: bot.path, revision: feed.revision, count: feed.cards.length })); break; }
  try {
    const result = gh(['api', '--method', 'PUT', endpoint, '--input', '-'], { branch: 'main', sha: current.sha, message: `Update ${batch.kind} study feedback (${batch.cards.length} cards)`, content: Buffer.from(JSON.stringify(feed, null, 2) + '\n').toString('base64') });
    const verify = gh(['api', endpoint + '?ref=main']);
    const saved = JSON.parse(Buffer.from(verify.content, 'base64').toString('utf8'));
    if (saved.revision < feed.revision || !batch.cards.every(c => saved.cards.some(s => s.id === c.id))) throw new Error('写入后的核对未通过，请检查提交，不要重复覆盖。');
    console.log(JSON.stringify({ published: true, path: bot.path, revision: feed.revision, count: batch.cards.length, commit: result.commit.html_url, learningUrl: 'https://ourbeings.com/ielts/' }));
    break;
  } catch (error) { if (!error.conflict || attempt === 2) throw error; }
}
