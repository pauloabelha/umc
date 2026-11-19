import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/simulator/?component=toggle-loop&mode=semantic');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.equal(await page.locator('#mode').inputValue(),'semantic');
  assert.equal(await page.locator('#mode option[value=gpu]').isDisabled(),false);
  assert.equal(await page.locator('#prototype-note').isVisible(),false);
  assert.equal(await page.locator('#gate-state').textContent(),'left');
  for(let i=0;i<30;i++) {
    await page.locator('#step').click();
    await page.waitForFunction(()=>!document.querySelector('#step').disabled);
  }
  assert.equal(await page.locator('#output').textContent(),'3 laps');
  assert.equal(await page.locator('#gate-state').textContent(),'right');
  const log=await page.locator('#execution-log').innerText();
  assert.match(log,/state left → right/);assert.match(log,/state right → left/);
  assert.match(log,/StraightTrack.left-entry/);assert.match(log,/StraightTrack.right-entry/);
  assert.equal(await page.locator('.log-component.purple').count()>0,true);
  await mkdir('artifacts',{recursive:true});
  await page.locator('.workspace').screenshot({path:'artifacts/lattice-loop.png'});
  await page.locator('#reset').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.equal(await page.locator('#gate-state').textContent(),'left');
  assert.equal(await page.locator('#execution-log .log-row').count(),1);
  await page.locator('#component').selectOption('t-gate');
  await page.locator('#step').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Completed');
  assert.equal(await page.locator('#output').textContent(),'left');
  await page.locator('#component').selectOption('two-bit-counter');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.match(await page.locator('#gate-state').textContent(),/B A = 00/);
  for(const [steps,bits] of [[5,'01'],[7,'10'],[5,'11'],[7,'00']]) {
    for(let i=0;i<steps;i++) {
      await page.locator('#step').click();
      await page.waitForFunction(()=>!document.querySelector('#step').disabled);
    }
    assert.match(await page.locator('#gate-state').textContent(),new RegExp(`B A = ${bits}`));
  }
  assert.equal(await page.locator('#output').textContent(),'4 laps');
  const counterLog=await page.locator('#execution-log').innerText();
  assert.match(counterLog,/TGate.gate-a/);assert.match(counterLog,/TGate.gate-b/);
  assert.match(counterLog,/Bypass.bypass/);
  await page.locator('.workspace').screenshot({path:'artifacts/two-bit-counter.png'});
  await page.locator('#reset').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.match(await page.locator('#gate-state').textContent(),/B A = 00/);
  await page.locator('[data-component="jump-machine"]').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.equal(await page.locator('#program').isVisible(),true);
  assert.equal(await page.locator('#program-rows tr').count(),5);
  assert.equal(await page.locator('#instruction-pointer').textContent(),'Live instruction: 1');
  for(const address of [3,2,4,1,5,2,4,1]) {
    await page.locator('#step').click();
    await page.waitForFunction(()=>!document.querySelector('#step').disabled);
    assert.equal(await page.locator('#instruction-pointer').textContent(),`Live instruction: ${address}`);
    assert.equal(await page.locator('#program-rows [aria-current="step"] td').first().textContent(),String(address));
  }
  assert.equal(await page.locator('#output').textContent(),'2 laps');
  await page.locator('#inspect-time').fill('1');
  await page.locator('#inspect-time').dispatchEvent('input');
  assert.equal(await page.locator('#instruction-pointer').textContent(),'Recorded instruction: 3');
  await page.screenshot({path:'artifacts/jump-machine.png',fullPage:true});
  await page.locator('#reset').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.equal(await page.locator('#instruction-pointer').textContent(),'Live instruction: 1');
  assert.match(await page.locator('#gate-state').textContent(),/bit = 0/);
  await page.locator('#component').selectOption('inc-register');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.match(await page.locator('#gate-state').textContent(),/0111 = 7/);
  for(const value of [6,6,4,4,0,0,8]) {
    await page.locator('#step').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent!=='Ready');
    assert.match(await page.locator('#gate-state').textContent(),new RegExp(`= ${value} ·`));
  }
  assert.equal(await page.locator('#status').textContent(),'Completed');
  assert.match(await page.locator('#execution-log').innerText(),/TGate.bit-3/);
  await page.locator('.workspace').screenshot({path:'artifacts/inc-register.png'});
  await page.locator('#reset').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.match(await page.locator('#gate-state').textContent(),/0111 = 7/);
  await page.locator('#component').selectOption('shared-register');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.match(await page.locator('#gate-state').textContent(),/next return: instruction 2/);
  for(let i=0;i<10;i++) {
    await page.locator('#step').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent!=='Ready');
  }
  assert.equal(await page.locator('#status').textContent(),'Completed');
  assert.match(await page.locator('#gate-state').textContent(),/1000 = 8/);
  assert.match(await page.locator('#gate-state').textContent(),/next return: instruction 6/);
  assert.equal(await page.locator('#elapsed').textContent(),'12.000 s');
  assert.match(await page.locator('#execution-log').innerText(),/CompletionMerge.collect-3/);
  await page.locator('.workspace').screenshot({path:'artifacts/shared-register.png'});
  await page.locator('#component').selectOption('straight-track');
  assert.equal(await page.locator('#program').isVisible(),false);
  assert.equal(await page.locator('#mode option[value=gpu]').isDisabled(),false);
  assert.deepEqual(errors,[]);
  console.log('Lattice browser checks passed: toggle loop, two-bit counting cycle, both routes, state log, reset, and physical availability.');
}finally{await browser.close();}
