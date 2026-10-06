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
        await wait(()=>window.walletRosterProof,240000);
        const rosterProof=await page.evaluate(()=>window.walletRosterProof);
        assert.ok(rosterProof.enemies.some(e=>e.kind!=='grunt'));
        fs.writeFileSync('evidence/roster-proof.json',JSON.stringify(rosterProof,null,2));
        await page.screenshot({path:'evidence/roster.png'});
        // Rules16 pauses replay for real user choices. Exercise those inputs
        // rather than waiting for the pre-card rules13 replay to finish itself.
        await wait(()=>window.walletCardProof,120000);
        const card=await page.evaluate(()=>window.walletCardProof);
        assert.equal(card.state.choosing,true);
        await page.keyboard.press(String(card.choice+1));
        await wait(()=>window.walletCardResult,10000);
        const chosen=await page.evaluate(()=>window.walletCardResult);
        assert.equal(chosen.tick,card.state.tick+1);
        assert.equal(chosen.simulation_tick,card.state.simulation_tick);
        assert.equal(chosen.cards[card.state.options[card.choice].id],1);
        fs.writeFileSync('evidence/cards.json',JSON.stringify({before:card.state,after:chosen},null,2));
        const choices=(async()=>{
          for(const kind of ['risk','reward','skip']) {
            await Promise.race([page.waitForFunction(k=>window.walletDecisionProof?.kind===k,kind,{timeout:120000}),failure]);
            const before=await page.evaluate(()=>window.walletDecisionProof);
            assert.equal(before.state.choosing,true);
            await page.screenshot({path:`evidence/nest-${kind}.png`});
            await page.keyboard.press(String(before.choice+1));
            await Promise.race([page.waitForFunction(k=>window.walletDecisionResult?.kind===k,kind,{timeout:10000}),failure]);
            const after=(await page.evaluate(()=>window.walletDecisionResult)).state;
            assert.equal(after.tick,before.state.tick+1);
            assert.equal(after.simulation_tick,before.state.simulation_tick);
            assert.equal(after.risk_state,{risk:'active',reward:'complete',skip:'skipped'}[kind]);
            if(kind==='risk') assert.equal(after.enemies.filter(e=>e.elite).length,3);
            if(kind==='reward') assert.equal(after.cards[before.state.options[before.choice].id],(before.state.cards[before.state.options[before.choice].id]||0)+1);
            fs.writeFileSync(`evidence/nest-${kind}.json`,JSON.stringify({before:before.state,after},null,2));
          }
        })();
        choices.catch(()=>{});
        await wait(()=>window.walletChainProof,240000);
        const proof=await page.evaluate(()=>window.walletChainProof);
        assert.ok(proof.max_chain>=2 && proof.bodies.length>=2);
        assert.ok(proof.events.some(e=>e.kind==='fall-hit'));
        fs.writeFileSync('evidence/chain-proof.json',JSON.stringify(proof,null,2));
        await page.screenshot({path:'evidence/chain.png'});
        await wait(()=>window.walletReplayResult,240000);
        const replay=await page.evaluate(()=>window.walletReplayResult);
        await choices;
        assert.deepEqual(replay,{cases:4,ok:true,ticks:expected.replay_ticks});
        fs.writeFileSync('evidence/replay.json',JSON.stringify(replay,null,2));
        const roster=await page.evaluate(()=>window.walletRosterResult);
        assert.equal(roster.kinds.length,8);
        for(const kind of ['armor-break','explosion','enemy-jump','enemy-crouch','enemy-turn','fall-hit']) assert.ok(roster.events[kind]>0,kind);
        fs.writeFileSync('evidence/roster-result.json',JSON.stringify(roster,null,2));
      }
      await wait(()=>window.walletProbe?.ready,120000);
      const initial=await page.evaluate(()=>window.walletProbe);
      assert.equal(initial.config.seed,1);
      assert.equal(initial.config.step_seconds,.05);
      assert.equal(initial.config.rotation_step,60);
      assert.equal(initial.config.fingerprint,expected.content_fingerprint);
      assert.equal(initial.config.content,expected.content);
      assert.equal(initial.config.rules,expected.rules);
      assert.equal(initial.projection,'cylinder-elevation');
      assert.equal(initial.started,false);
      assert.equal(initial.tick,0);
      if(mobile) await page.touchscreen.tap(195,420);
      else await page.keyboard.press('Enter');
      await wait(()=>window.walletProbe.started && window.walletProbe.tick>=1);
      if (mobile) {
        const cdp=await context.newCDPSession(page);
        const c=await page.locator('canvas').boundingBox(); assert.ok(c);
        const point=(x,y,id)=>({x:c.x+c.width*x,y:c.y+c.height*y,id});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(.37,.895,1),point(.62,.895,2),point(.87,.895,3)]});
        await wait(()=>window.walletProbe.inputs.rotation>0 && window.walletProbe.events["wall-shot"]>0 && window.walletProbe.events["wall-wave"]===1);
        await wait(()=>window.walletProbe.tick>=95);
        assert.equal(await page.evaluate(()=>window.walletProbe.events['wall-wave']),1);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(.87,.895,3)]});
        await wait(()=>window.walletProbe.events['wall-wave']===2);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      } else {
        await page.keyboard.down('d');await page.keyboard.down('Space');await page.keyboard.down('e');
        await wait(()=>window.walletProbe.inputs.rotation>0 && window.walletProbe.events["wall-shot"]>0 && window.walletProbe.events["wall-wave"]===1);
        await wait(()=>window.walletProbe.tick>=95);
        assert.equal(await page.evaluate(()=>window.walletProbe.events['wall-wave']),1);
        await page.keyboard.up('d');await page.keyboard.up('Space');await page.keyboard.up('e');
        await page.keyboard.press('e');
        await wait(()=>window.walletProbe.events['wall-wave']===2);
      }
      const tickBefore=await page.evaluate(()=>window.walletProbe.tick);
      const timeBefore=Date.now();
      await wait(()=>window.walletProbe.tick>=150);
      const probe=await page.evaluate(()=>window.walletProbe);assert.ok(probe.wave>=1);
      const rate=(probe.tick-tickBefore)/((Date.now()-timeBefore)/1000);
      assert.ok(rate>12 && rate<26,'live clock: '+rate);
      const name=mobile?'mobile':'desktop';
      await page.screenshot({path:`evidence/${name}.png`});
      fs.writeFileSync(`evidence/${name}.json`,JSON.stringify(probe,null,2));
      await context.close();
    }
    assert.ok(!logs.some(x=>x.includes('PAGE_ERROR') || x.includes('SCRIPT ERROR:')));
    console.log('LIVE_GAME_PASS: public HTTPS, exact build, verified roster/card/nest replay and real falling-chain proof, keyboard and simultaneous touch');
  } catch(error) {
    if(current && !current.isClosed()) await current.screenshot({path:'evidence/failure.png'}).catch(()=>{});
    throw error;
  } finally {
    fs.writeFileSync('evidence/browser.log',logs.join('\n'));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

