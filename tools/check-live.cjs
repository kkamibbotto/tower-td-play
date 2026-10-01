const {chromium} = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const expected = require('../build.json');
const url = new URL(process.env.PLAY_URL);
assert.equal(url.origin, 'https://kkamibbotto.github.io');
assert.equal(url.pathname, '/tower-td-play/');
fs.mkdirSync('evidence', {recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const logs=[];
  let current;
  try {
    for (const mobile of [false,true]) {
      const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:960,height:800},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
      const page = await context.newPage(); current=page;
      let rejectFailure;
      const failure = new Promise((_, reject) => {rejectFailure=reject;});
      failure.catch(()=>{});
      page.on('pageerror', e=>{logs.push('PAGE_ERROR '+e.message);rejectFailure(e);});
      page.on('console', m=>{const text=m.text();logs.push(text);if(text.includes('SCRIPT ERROR:')) rejectFailure(new Error(text));});
      const wait = (fn, timeout=30000) => Promise.race([page.waitForFunction(fn,null,{timeout}),failure]);
      const info = await context.request.get(new URL('build-info.json',url).href);
      assert.ok(info.ok(), 'deployed build manifest unavailable');
      const actual = await info.json();
      assert.equal(actual.archive_sha256,expected.sha256);
      assert.equal(actual.source_commit,expected.source_commit);
      await page.goto(url.href+(mobile?'':'?test=1'), {waitUntil:'domcontentloaded',timeout:60000});
      if (!mobile) {
        await wait(()=>window.walletReplayResult,240000);
        const replay=await page.evaluate(()=>window.walletReplayResult);
        assert.deepEqual(replay,{cases:4,ok:true,ticks:5856});
        fs.writeFileSync('evidence/replay.json',JSON.stringify(replay,null,2));
      }
      await wait(()=>window.walletProbe?.ready,120000);
      if (mobile) {
        const cdp=await context.newCDPSession(page);
        const c=await page.locator('canvas').boundingBox(); assert.ok(c);
        const point=(x,y,id)=>({x:c.x+c.width*x,y:c.y+c.height*y,id});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(.85,.45,1),point(.62,.895,2),point(.87,.895,3)]});
        await wait(()=>window.walletProbe.inputs.rotation>0 && window.walletProbe.inputs.stone>0 && window.walletProbe.inputs.shock>0);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      } else {
        await page.keyboard.down('d');await page.keyboard.down('Space');await page.keyboard.down('e');
        await wait(()=>window.walletProbe.inputs.rotation>0 && window.walletProbe.inputs.stone>0 && window.walletProbe.inputs.shock>0);
        await page.keyboard.up('d');await page.keyboard.up('Space');await page.keyboard.up('e');
      }
      const probe=await page.evaluate(()=>window.walletProbe);assert.ok(probe.wave>=1);
      const name=mobile?'mobile':'desktop';
      await page.screenshot({path:`evidence/${name}.png`});
      fs.writeFileSync(`evidence/${name}.json`,JSON.stringify(probe,null,2));
      await context.close();
    }
    assert.ok(!logs.some(x=>x.includes('PAGE_ERROR') || x.includes('SCRIPT ERROR:')));
    console.log('LIVE_GAME_PASS: public HTTPS, exact build, 5856 replay ticks, keyboard and simultaneous touch');
  } catch(error) {
    if(current && !current.isClosed()) await current.screenshot({path:'evidence/failure.png'}).catch(()=>{});
    throw error;
  } finally {
    fs.writeFileSync('evidence/browser.log',logs.join('\n'));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
