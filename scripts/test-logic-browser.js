import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const checks=[],errors=[];
const reference={buffer:a=>a,not:a=>1-a,and:(a,b)=>a&b,or:(a,b)=>a|b,nand:(a,b)=>1-(a&b),nor:(a,b)=>1-(a|b),xor:(a,b)=>a^b,xnor:(a,b)=>1-(a^b)};
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#logic-status')?.textContent==='Ready');
 const set=async(id,value)=>{await page.locator(`#${id}`).selectOption(String(value));await ready();};
 await page.goto('http://127.0.0.1:5173/simulator/logic.html?mode=semantic');await ready();
 assert.deepEqual(await page.locator('#logic-gate option').evaluateAll(os=>os.map(o=>o.value)),[...Object.keys(reference),'half-adder']);
 for(const gate of [...Object.keys(reference),'half-adder']) {
  await set('logic-gate',gate);
  for(const a of [0,1])for(const b of (['buffer','not'].includes(gate)?[0]:[0,1])) {
   await set('input-a',a);if(!['buffer','not'].includes(gate))await set('input-b',b);
   assert.equal(await page.locator('#logic-output').textContent(),'—');
   await page.locator('#logic-run').click();assert.equal(await page.locator('#input-a').isDisabled(),true);
   await page.locator('#logic-run').click();
   await page.evaluate(async()=>{
    const until=Date.now()+10000;
    while(Number(document.querySelector('#logic-laps').textContent)<1&&Date.now()<until){
     const step=document.querySelector('#logic-step');if(!step.disabled)step.click();
     await new Promise(resolve=>setTimeout(resolve,0));
    }
   });
   assert.equal(await page.locator('#logic-laps').textContent(),'1');
   assert.equal(await page.locator('#logic-output').textContent(),String(gate==='half-adder'?a^b:reference[gate](a,b)));
   if(gate==='half-adder')assert.equal(await page.locator('#logic-carry').textContent(),String(a&b));
   assert.match(await page.locator('#logic-history').textContent(),/rail/);
   checks.push({gate,a,b,mode:'semantic',passed:true});
  }
 }
 await page.locator('.workspace').screenshot({path:'artifacts/logic-half-adder.png'});
 for(const mode of process.env.UMC_TEST_GPU==='1'?['cpu','gpu']:['cpu']) {
  await set('logic-gate','and');await set('input-a',1);await set('input-b',1);await set('logic-mode',mode);
  await page.locator('#logic-run').click();
  await page.getByRole('button',{name:'Cell wireframe'}).click();
  await page.waitForFunction(()=>Number(document.querySelector('#logic-laps').textContent)>=1,null,{timeout:120000});
  await page.locator('#logic-run').click();assert.equal(await page.locator('#logic-output').textContent(),'1');
  assert.equal(await page.locator('#logic-mode').inputValue(),mode);
  checks.push({gate:'and',a:1,b:1,mode,passed:true});
 }
 await page.locator('#logic-reset').click();await ready();assert.equal(await page.locator('#logic-laps').textContent(),'0');assert.equal(await page.locator('#logic-output').textContent(),'—');
 await page.route('http://127.0.0.1:8792/**',route=>route.abort());
 await set('logic-mode','semantic');
 await page.locator('#logic-mode').selectOption('gpu');
 await page.waitForFunction(()=>document.querySelector('#logic-status').textContent==='Error');
 assert.equal(await page.locator('#logic-mode').inputValue(),'gpu');
 assert.equal(await page.locator('#logic-output').textContent(),'—');
 assert.equal(await page.locator('#logic-error').isVisible(),true);
 await page.unroute('http://127.0.0.1:8792/**');
 await set('logic-mode','semantic');await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('.workspace').screenshot({path:'artifacts/logic-mobile.png'});
 assert.deepEqual(errors,[]);await mkdir('artifacts',{recursive:true});
 await writeFile('artifacts/logic-browser.json',JSON.stringify({passed:true,checks},null,2));console.log(`${checks.length} logic browser evaluations passed, including reset, input locking, wireframe and mobile.`);
}finally{await browser.close();}
