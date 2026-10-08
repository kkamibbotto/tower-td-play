const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
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
      if(!mobile) { await wait(()=>window.walletCharacterReplayResult,240000); assert.deepEqual(await page.evaluate(()=>window.walletCharacterReplayResult),{ok:true,cases:4,ticks:expected.character_replay_ticks}); }
      await wait(()=>window.walletProbe?.ready && window.walletProbe.config.content==='character-playtest-1' && window.walletProbe.tick===0,120000);
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
      await wait(()=>window.walletProbe.events['wall-shot']>=2,10000);
      assert.equal(await page.evaluate(()=>window.walletProbe.inputs.stone),0);
      assert.equal(await page.evaluate(()=>window.walletProbe.events['wall-wave']||0),0);
      const device=mobile?'mobile':'desktop';
      const trace=[];
      const capture=async phase=>{
        const probe=await page.evaluate(()=>window.walletProbe);
        trace.push({phase,probe});
        fs.writeFileSync(path.join("evidence",`${device}-shock-trace.json`),JSON.stringify(trace,null,2));
        return probe;
      };
      // A real decision freezes combat and cancels held controls. Select through
      // the same keyboard/touch UI and verify the exact core choice frame.
      const decide=async()=>{
        const before=await capture('choice');
        assert.equal(before.choosing,true);
        assert.ok(before.options.length>0);
        assert.ok(['card','reward','risk'].includes(before.decision),'unknown live decision');
        await page.waitForTimeout(100);
        const frozen=await page.evaluate(()=>window.walletProbe);
        assert.equal(frozen.tick,before.tick,'live decision must freeze recording');
        assert.equal(frozen.simulation_tick,before.simulation_tick);
        const index=before.decision==='risk'?before.options.findIndex(o=>o.id==='risk-skip'):0;
        assert.ok(index>=0);
        if(mobile) {
          const box=await page.locator('canvas').boundingBox();
          assert.ok(box);
          await page.touchscreen.tap(box.x+box.width*.5,box.y+box.height*(.30+index*.17+.075));
        } else await page.keyboard.press(String(index+1));
        await page.waitForFunction(t=>window.walletProbe.last_choice?.before.tick===t,before.tick,{timeout:10000});
        const result=(await capture('choice-result')).last_choice;
        assert.equal(result.index,index);
        assert.equal(result.after.tick,before.tick+1);
        assert.equal(result.after.simulation_tick,before.simulation_tick,'choice must not advance simulation');
        assert.equal(result.after.choosing,false);
        if(before.decision==='risk') assert.equal(result.after.risk_state,'skipped');
        else assert.equal(result.after.cards[before.options[index].id],(before.cards[before.options[index].id]||0)+1);
      };
      const liveWait=async(predicate,timeout)=>{
        const deadline=Date.now()+timeout;
        while(Date.now()<deadline) {
          const p=await page.evaluate(()=>window.walletProbe);
          assert.equal(p.finished,false,'live input run ended before acceptance');
          assert.equal(p.paused,false,'live input run unexpectedly paused');
          if(p.choosing) await decide();
          else if(predicate(p)) return await capture('live-wait');
          else await Promise.race([page.waitForTimeout(50),failure]);
        }
        throw new Error('live input deadline: '+predicate.toString());
      };
      let cdp,points;
      if(mobile) {
        cdp=await context.newCDPSession(page);
        const canvas=await page.locator('canvas').boundingBox();
        assert.ok(canvas);
        const point=(x,y,id)=>({x:canvas.x+canvas.width*x,y:canvas.y+canvas.height*y,id});
        const geometry=await page.evaluate(()=>window.walletProbe.controls);
        assert.equal(geometry.drag,true); assert.equal(geometry.basic_button,false);
        const [sx,sy,sw,sh]=geometry.skill, [vw,vh]=geometry.viewport;
        assert.ok(sx>=0 && sy>=0 && sx+sw<=vw && sy+sh<=vh);
        points=[point(.45,.5,1),point((sx+sw/2)/vw,(sy+sh/2)/vh,3)];
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
        points[0]=point(.60,.5,1);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points});
      } else {
        const canvas=await page.locator('canvas').boundingBox();
        await page.mouse.move(canvas.x+canvas.width*.45,canvas.y+canvas.height*.5);
        await page.mouse.down();
        await page.mouse.move(canvas.x+canvas.width*.6,canvas.y+canvas.height*.5,{steps:4});
        await liveWait(p=>p.inputs.rotation>0,10000);
        await page.mouse.up();
        const stopped=await capture('mouse-lift');
        await page.waitForTimeout(150);
        assert.equal((await capture('mouse-no-drift')).inputs.rotation,stopped.inputs.rotation);
        await page.keyboard.down('d'); await page.keyboard.down('e');
      }
      await liveWait(p=>p.inputs.rotation>0 && p.events['wall-shot']>0 && p.events['wall-wave']===1,10000);
      // tick 95 alone is not a cooldown guarantee: first input delivery varies
      // with Web frames, and recording ticks include frozen choice frames.
      await liveWait(p=>p.tick>=95 && p.abilities.some(a=>a.id==='shock' && !a.casting && p.simulation_tick>=a.ready_at),15000);
      // Observe held input across additional ready ticks, not just during cooldown.
      await capture('held-ready');
      await liveWait(p=>p.abilities.some(a=>a.id==='shock' && !a.casting && p.simulation_tick>=a.ready_at+4) && p.tick>=99,10000);
      assert.equal((await capture('held-no-repeat')).events['wall-wave'],1,mobile?'held touch must not repeat shock':'held E must not repeat shock');
      if(mobile) await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      else {await page.keyboard.up('d');await page.keyboard.up('e');}
      const beforeSecond=await capture('before-second-press');
      assert.equal(beforeSecond.choosing,false);
      assert.equal(beforeSecond.inputs.shock,1,'held skill must deliver exactly one edge');
      if(mobile) await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[1]]});
      else await page.keyboard.press('e');
      await liveWait(p=>p.events['wall-wave']===2,10000);
      const second=await capture('second-wave');
      assert.equal(second.inputs.shock,beforeSecond.inputs.shock+1,'one fresh input must reach the core');
      if(mobile) await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.ok(await page.evaluate(()=>window.walletProbe.wave>=1),'wave display did not retain its core event');
      // Measure an uninterrupted combat interval; decision UI time is not clock drift.
      const rateDeadline=Date.now()+15000;
      let clockStart=await page.evaluate(()=>window.walletProbe),startTime=Date.now(),rate;
      while(Date.now()<rateDeadline) {
        await page.waitForTimeout(50);
        const p=await page.evaluate(()=>window.walletProbe);
        assert.equal(p.finished,false);
        assert.equal(p.paused,false);
        if(p.choosing) {
          await decide();
          clockStart=await page.evaluate(()=>window.walletProbe);startTime=Date.now();
        } else if(p.tick>=150 && p.simulation_tick-clockStart.simulation_tick>=40) {
          rate=(p.simulation_tick-clockStart.simulation_tick)/((Date.now()-startTime)/1000);
          break;
        }
      }
      assert.ok(rate>12 && rate<26,'live clock differs substantially from 20Hz: '+rate);
      await page.screenshot({path:path.join("evidence",mobile?'mobile.png':'desktop.png')});
      fs.writeFileSync(path.join("evidence",mobile?'mobile-input.json':'desktop-input.json'),JSON.stringify(await page.evaluate(()=>window.walletProbe),null,2));
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

