import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/simulator/');
  await page.locator('a.machine-card').click();
  await page.waitForSelector('#machine-program tr');
  assert.equal(await page.locator('#machine-program tr').count(),7);
  for(const [pc,a,b] of [[2,1,0],[5,1,0],[6,2,0],[3,2,0],[4,2,1],[7,2,1],[1,2,1]]) {
    await page.locator('#machine-step').click();
    assert.equal(await page.locator('#pc').textContent(),String(pc));
    assert.equal(await page.locator('#register-a').textContent(),String(a));
    assert.equal(await page.locator('#register-b').textContent(),String(b));
    assert.equal(await page.locator('[aria-current="step"] td').first().textContent(),String(pc));
  }
  assert.equal(await page.locator('#machine-log tr').count(),7);
  await page.locator('#machine-speed').selectOption('10');
  assert.equal(await page.locator('#register-a').textContent(),'0');
  await page.locator('#machine-run').click();
  await page.waitForFunction(()=>Number(document.querySelector('#register-b').textContent)>=2);
  await page.locator('#machine-run').click();
  assert.equal(await page.locator('#machine-status').textContent(),'Paused');
  const download=page.waitForEvent('download');await page.locator('#machine-download').click();
  assert.equal((await download).suggestedFilename(),'umc-inc-jump-log.json');
  await page.locator('#machine-reset').click();
  assert.equal(await page.locator('#pc').textContent(),'1');
  assert.equal(await page.locator('#register-b').textContent(),'0');
  assert.equal(await page.locator('#machine-log tr').count(),0);
  await page.locator('#machine-backend').selectOption('gates');
  assert.equal(await page.locator('#gate-details').isVisible(),true);
  assert.equal(await page.locator('#gate-states tr').count(),9);
  await page.locator('#machine-microstep').click();
  assert.equal(await page.locator('#gate-location').textContent(),'a-bit-0');
  assert.equal(await page.locator('#pc').textContent(),'1');
  await page.locator('#machine-microstep').click();
  assert.equal(await page.locator('#register-a').textContent(),'1');
  assert.equal(await page.locator('#gate-location').textContent(),'a-return');
  assert.equal(await page.locator('#pc').textContent(),'1');
  await page.locator('#machine-microstep').click();
  assert.equal(await page.locator('#pc').textContent(),'2');
  assert.match(await page.locator('#gate-trace').textContent(),/a-return.*i2/);
  await page.locator('#machine-step').click(); // JUMP 5
  await page.locator('#machine-step').click(); // second caller of a
  assert.equal(await page.locator('#register-a').textContent(),'2');
  assert.equal(await page.locator('#pc').textContent(),'6');
  assert.match(await page.locator('#gate-trace').textContent(),/a-return.*i6/);
  for(let i=0;i<60&&!await page.locator('#machine-step').isDisabled();i++)await page.locator('#machine-step').click();
  assert.match(await page.locator('#machine-status').textContent(),/overflow/);
  assert.equal(await page.locator('#machine-run').isDisabled(),true);
  await page.locator('#machine-reset').click();
  assert.equal(await page.locator('#machine-step').isDisabled(),false);
  assert.equal(await page.locator('#register-a').textContent(),'0');
  await page.locator('#machine-width').selectOption('8');
  assert.equal(await page.locator('#gate-states tr').count(),17);
  await page.locator('#machine-run').click();
  await page.waitForFunction(()=>document.querySelector('#gate-location').textContent!=='i1');
  await page.locator('#machine-run').click();
  assert.equal(await page.locator('#machine-status').textContent(),'Paused');
  await page.locator('#machine-backend').selectOption('lattice');
  await page.locator('#machine-width').selectOption('4');
  for(const [pc,a,b] of [[2,1,0],[5,1,0],[6,2,0],[3,2,0],[4,2,1],[7,2,1],[1,2,1]]) {
    await page.locator('#machine-step').click();
    assert.equal(await page.locator('#pc').textContent(),String(pc));
    assert.equal(await page.locator('#register-a').textContent(),String(a));
    assert.equal(await page.locator('#register-b').textContent(),String(b));
  }
  assert.match(await page.locator('#gate-trace').textContent(),/wire-/);
  await page.locator('#machine-microstep').click();
  assert.equal(await page.locator('#pc').textContent(),'1');
  assert.equal(await page.locator('#gate-location').textContent(),'a-entry');
  await page.locator('#machine-reset').click();
  assert.equal(await page.locator('#gate-location').textContent(),'i1');
  await page.goto('http://127.0.0.1:5173/simulator/?component=seven-instruction-lattice&mode=semantic');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.equal(await page.locator('#program-rows tr').count(),7);
  assert.match(await page.locator('#gate-state').textContent(),/a = 0.*b = 0/);
  assert.equal(await page.locator('#mode option[value=gpu]').isDisabled(),false);
  await page.locator('#step').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Paused');
  assert.equal(await page.locator('#instruction-pointer').textContent(),'Live instruction: 1');
  await page.locator('.workspace').screenshot({path:'artifacts/seven-instruction-lattice.png'});
  assert.deepEqual(errors,[]);
  console.log('Machine browser checks passed: seven instructions, shared register effects, jumps, run/pause, log export, reset.');
} finally {await browser.close();}
