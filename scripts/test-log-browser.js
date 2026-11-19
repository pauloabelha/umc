import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/simulator/?component=closed-loop&mode=semantic');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  for(let i=0;i<5;i++){await page.locator('#step').click();await page.waitForFunction(()=>!document.querySelector('#step').disabled);}
  const log=await page.locator('#execution-log').innerText();
  for(const name of ['FerryElevator.elevator','StraightTrack.top-track','Curve90.bend-1','Ramp.ramp'])assert.ok(log.includes(name),name);
  for(const color of ['red','yellow','teal','blue'])assert.ok(await page.locator(`#execution-log .${color}`).count()>0);
  assert.ok(await page.locator('#execution-log .log-port').count()>0);
  await page.locator('#verbose-log').uncheck();
  assert.equal(await page.locator('#execution-log .log-port').count(),0);
  await page.locator('#verbose-log').check();
  const waiting=page.waitForEvent('download');await page.locator('#download-log').click();const download=await waiting;
  await download.saveAs('artifacts/computation.log');
  assert.match(await readFile('artifacts/computation.log','utf8'),/FerryElevator\.elevator \[out\] → StraightTrack\.top-track \[in\]/);
  await page.locator('#tracking').screenshot({path:'artifacts/colored-log.png'});
  await page.locator('.workspace').screenshot({path:'artifacts/closed-loop.png'});
  assert.deepEqual(errors,[]);console.log('Colored ComponentName.ID trace, verbose ports, and full export passed.');
}finally{await browser.close();}
