import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/simulator/?component=t-gate&mode=semantic');
  await page.waitForFunction(()=>document.querySelector('#stage-title').textContent.includes('T-gate'));
  for(let i=0;i<8;i++) {
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='Completed');
    assert.equal(await page.locator('#output').textContent(),i%2?'right':'left');
    assert.equal(await page.locator('#gate-state').textContent(),i%2?'left':'right');
    assert.equal(await page.locator('#elapsed').textContent(),`${i+1}.000 s`);
    assert.equal(await page.locator('#run').textContent(),'Send marble again');
  }
  await mkdir('artifacts',{recursive:true});
  await page.locator('.workspace').screenshot({path:'artifacts/t-gate.png'});
  await page.locator('#reset').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.equal(await page.locator('#gate-state').textContent(),'left');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#component').value==='t-gate');
  assert.deepEqual(errors,[]);
  console.log('T-gate: eight alternating passages retain state and history; Reset and URL reload passed.');
} finally {await browser.close();}
