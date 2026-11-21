import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL || 'http://127.0.0.1:4173/ielts/';
const browser=await chromium.launch(process.env.CI?{}:{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(base+'#practice');
  const courses=page.locator('.course-card');await courses.first().waitFor();assert.equal(await courses.count(),2);
  assert.ok((await courses.first().innerText()).includes('播音员 23 句'));
  await courses.first().getByRole('button',{name:'开始',exact:true}).click();
  assert.ok((await page.locator('.review-top').innerText()).includes('第 1 句 · ANNOUNCER'));
  assert.equal(await page.locator('.review-card .english').count(),0,'answer stays hidden before dictation');
  await page.getByRole('button',{name:'回忆好了，核对答案'}).click();
  assert.ok((await page.locator('.review-card').innerText()).includes('Cambridge English'));
  await page.getByRole('button',{name:/^记住/}).click();
  assert.ok((await page.locator('.review-top').innerText()).includes('第 2 句 · ANNOUNCER'));
  await page.reload();await page.locator('.course-card').first().getByRole('button',{name:'开始',exact:true}).click();
  assert.ok((await page.locator('.review-top').innerText()).includes('第 2 句 · ANNOUNCER'));
  await page.getByRole('button',{name:'稍后继续'}).click();
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('myielts.state.v1'));for(const p of Object.values(s.progress))p.due=Date.now()-1000;localStorage.setItem('myielts.state.v1',JSON.stringify(s));});
  await page.reload();await page.locator('.course-card').first().locator('select').selectOption('review');await page.locator('.course-card').first().getByRole('button',{name:'开始',exact:true}).click();
  assert.ok((await page.locator('.review-top').innerText()).includes('第 1 句 · ANNOUNCER'));
  await page.getByRole('button',{name:'稍后继续'}).click();
  await page.screenshot({path:'.test-artifacts/mobile-complete-courses.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('PASS: two complete courses, announcer included, hidden dictation answer, ordered grading, reload resume, due review, mobile layout.');
}finally{await browser.close();}
