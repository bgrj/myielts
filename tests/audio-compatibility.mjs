import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.TEST_URL || 'http://127.0.0.1:4173/ielts/';
const engines=process.env.TEST_ENGINES?.split(',') || ['chromium'];
for(const name of engines){
  const browser=await ({chromium,firefox,webkit})[name].launch(name==='chromium'&&!process.env.CI?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}:{headless:true});
  try{
    for(const fallback of [false,true]){
      const context=await browser.newContext({viewport:{width:390,height:844}});
      if(!process.env.TEST_URL)await context.route(/\/(?:data\/reading-audio|feeds\/reading-audio)\.json(?:\?|$)/,async route=>{
        const data=JSON.parse(await readFile('content/reading-audio-manifest.json','utf8'));
        for(const c of data.clips)c.url=new URL('recordings/'+c.url.split('/').pop(),base).href;
        await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
      });
      await context.addInitScript(fallback=>{
        window.__synth=0;if(window.speechSynthesis)window.speechSynthesis.speak=()=>window.__synth++;
        if(fallback){
          Object.defineProperty(window,'structuredClone',{value:undefined,configurable:true});
          Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});
          if(window.AbortSignal)Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
          if(window.HTMLDialogElement){HTMLDialogElement.prototype.showModal=undefined;HTMLDialogElement.prototype.close=undefined;}
          const play=HTMLMediaElement.prototype.play;let first=true;
          HTMLMediaElement.prototype.play=function(){if(first){first=false;return Promise.reject(new DOMException('Gesture needed','NotAllowedError'));}return play.call(this);};
        }
      },fallback);
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'#library',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#library-search').fill('housing');
      await page.locator('[data-action="open-card"][data-id="c17-t1-p1-087"]').click();
      await page.locator('#card-dialog').getByRole('button',{name:'播放',exact:true}).click();
      assert.ok(await page.locator('#card-dialog #audio-dock').isVisible(),'native controls remain usable inside a modal');
      if(fallback){await page.locator('#audio-resume').waitFor({state:'visible'});await page.locator('#audio-resume').click();}
      await page.waitForFunction(()=>document.querySelector('#shared-audio').currentTime>.2,undefined,{timeout:25000});
      assert.equal(await page.evaluate(()=>window.__synth),0);
      assert.ok((await page.locator('#shared-audio').getAttribute('src')).includes('/recordings/reading-'));
      await page.locator('#card-dialog select[aria-label="播放方式"]').selectOption('slow');
      await page.locator('#card-dialog').getByRole('button',{name:'播放',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#shared-audio').currentTime>.2);
      assert.equal(await page.locator('#shared-audio').evaluate(a=>a.playbackRate),.8);
      await page.getByRole('button',{name:'关闭播放器',exact:true}).click();
      await page.getByRole('button',{name:'关闭知识卡'}).click();
      await page.getByRole('link',{name:'随手练习',exact:true}).click();
      await page.locator('[data-action="lesson"][data-lesson="self-drive"]').click();
      await page.getByRole('button',{name:'播放',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#shared-audio').currentTime>.2);
      assert.equal(await page.evaluate(()=>window.__synth),0);
      await page.getByRole('button',{name:'回忆好了，核对答案'}).click();await page.getByRole('button',{name:/^记住/}).click();
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('myielts.state.v1')).events.length),1);
      assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      console.log(`PASS ${name}: natural MP3 + original listening, native modal controls, slow replay, grading${fallback?', missing-API fallbacks and blocked-play recovery':''}`);
      await context.close();
    }
  }finally{await browser.close();}
}
