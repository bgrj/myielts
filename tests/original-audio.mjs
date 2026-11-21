import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/ielts/';
const browser = await chromium.launch(process.env.CI ? {} : { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
if (!process.env.TEST_URL) {
  await context.route(/\/(?:data\/cards|feeds\/listening)\.json(?:\?|$)/, async route => {
    const listing = route.request().url().includes('/data/') ? JSON.parse(await readFile('web/data/cards.json','utf8')) : JSON.parse(await readFile('content/listening.json','utf8'));
    for (const c of Array.isArray(listing) ? listing : listing.cards) if (c.audio) c.audio.url = new URL('recordings/' + c.audio.url.split('/').pop(), base).href;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(listing)});
  });
}
await context.addInitScript(() => {
  window.__players = []; window.__synthCount = 0;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    if (!window.__players.includes(this)) window.__players.push(this);
    (this.__times ||= []).push(performance.now());
    return play.call(this);
  };
  if (window.speechSynthesis) window.speechSynthesis.speak = () => window.__synthCount++;
});
const page = await context.newPage(); const errors=[];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(base+'#library');
  await page.locator('#library-search').fill('At the end');
  await page.locator('[data-action="open-card"][data-id="c10-t1-s1-06"]').click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { polling:100 });
  await page.locator('#card-dialog').getByRole('button',{name:'播放原音',exact:true}).click();
  await page.waitForFunction(() => window.__players.at(-1)?.currentTime > .15, undefined, { polling:100 });
  const first = await page.evaluate(() => ({ duration:window.__players.at(-1).duration, src:window.__players.at(-1).src, synth:window.__synthCount }));
  assert.ok(first.duration > 1 && first.duration < 4); assert.equal(first.synth,0); assert.ok(first.src.includes('c10-t1-s1-06-'));
  await page.getByRole('button',{name:'停止',exact:true}).click();
  await page.getByRole('button',{name:'原音三遍',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('[data-original-status]')?.textContent.includes('共 3 遍'), undefined, { polling:100, timeout:45000 });
  const triple = await page.evaluate(() => ({times:window.__players.at(-1).__times,duration:window.__players.at(-1).duration,synth:window.__synthCount}));
  assert.equal(triple.times.length,3); assert.equal(triple.synth,0);
  assert.ok(triple.times[1]-triple.times[0] >= triple.duration*1000+2700);
  assert.ok(triple.times[2]-triple.times[1] >= triple.duration*1000+2700);
  const cached = await page.evaluate(async url => {const names=await caches.keys();const key=names.find(n=>n.endsWith('original-audio-v1'));return key ? !!await (await caches.open(key)).match(url) : false;}, first.src);
  assert.ok(cached,'original audio must be stored for offline playback');
  await context.setOffline(true);
  await page.getByRole('button',{name:'播放原音',exact:true}).click();
  await page.waitForFunction(() => window.__players.at(-1)?.currentTime > .15 && !window.__players.at(-1).paused, undefined, {polling:100});
  await mkdir('.test-artifacts',{recursive:true});
  await page.screenshot({path:'.test-artifacts/mobile-original-audio.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: real MP3 decodes and plays, exact original clip mapping, three repetitions with 3-second pauses, no speech synthesis, offline original-audio playback.');
} finally {await browser.close();}
