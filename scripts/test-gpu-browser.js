import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

// Requires the real CUDA service; a completed lap rules out a ready-only smoke test.
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/simulator/?component=toggle-loop&mode=gpu&scale=1');
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='Ready');
  await page.locator('#run').click();
  await page.waitForFunction(()=>parseInt(document.querySelector('#output').textContent,10)>=1,null,{timeout:120000});
  await page.locator('#run').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Paused');
  assert.equal(await page.locator('#mode').inputValue(),'gpu');
  assert.deepEqual(errors,[]);
  const result={passed:true,mode:'gpu',output:await page.locator('#output').textContent(),status:await page.locator('#status').textContent()};
  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/gpu-loop-browser.png'});
  await writeFile('artifacts/gpu-browser-results.json',JSON.stringify(result,null,2));
  console.log(result);
  await page.locator('#mode').selectOption('semantic');
} finally {await browser.close();}
