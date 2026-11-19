import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {browserItems} from '../src/simulator/component-browser.js';
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({args:['--enable-unsafe-swiftshader']});
try {
  const desktop=await browser.newPage();
  for(const item of browserItems) {
    await desktop.goto(base+item.href);
    await desktop.waitForFunction(()=>document.querySelector('#status, #logic-status, #machine-status')?.textContent==='Ready');
    assert.equal(await desktop.locator('.browser-card[aria-current="page"]').getAttribute('data-item'),item.id);
  }
  await desktop.setViewportSize({width:390,height:844});
  await desktop.waitForFunction(()=>{const card=document.querySelector('.browser-card[aria-current="page"]'), row=document.querySelector('.component-row');return card.getBoundingClientRect().left>=row.getBoundingClientRect().left-1&&card.getBoundingClientRect().right<=row.getBoundingClientRect().right+1;});
  await desktop.close();
  console.log('PASS all 23 destinations and selected card after resize');
  for (const width of [320, 390, 768]) {
    const page = await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    for (const path of ['/simulator/?component=closed-loop&mode=semantic', '/simulator/logic.html', '/simulator/machine.html']) {
      await page.goto(base+path);
      const machine=path.includes('machine.html'), logic=path.includes('logic.html');
      const step=page.locator(machine?'#machine-step':logic?'#logic-step':'#step');
      if (logic) await page.locator('#logic-mode').selectOption('semantic');
      await step.waitFor();
      if(width<=720) {
        await page.evaluate(()=>scrollTo(0,0));
        const run=page.locator(machine?'#machine-run':logic?'#logic-run':'#run');
        const runBox=await run.boundingBox();
        const viewBox=await page.locator(machine?'.readout':'#viewport').boundingBox();
        assert.ok(runBox.y<150, 'Run must appear at the top on mobile');
        assert.ok(viewBox.y>runBox.y && viewBox.y+viewBox.height<=844, 'Run and live view must fit together');
        await run.tap();
        await page.waitForFunction(()=>[...document.querySelectorAll('.simulation-actions button')].some(b=>b.textContent==='Pause'));
        await run.tap();
        await page.locator(machine?'#machine-reset':logic?'#logic-reset':'#reset').tap();
      }
      await step.tap();
      await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.id==='step'||b.id==='logic-step'||b.id==='machine-step')?.disabled);
      if(machine) assert.equal(await page.locator('#register-a').textContent(),'1');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow: ${width} ${path}`);
      if(!machine) assert.ok(await page.locator('#viewport canvas').count()>0);
      const shelf=page.locator('.component-row');
      assert.equal(await shelf.locator('.browser-card').count(),23);
      assert.equal(await shelf.locator('[aria-current="page"]').count(),1);
      assert.ok(await shelf.evaluate(el=>el.scrollWidth>el.clientWidth),'Shelf must scroll horizontally');
      await page.getByRole('button',{name:'Gates',exact:true}).tap();
      assert.equal(await shelf.locator('.browser-card:visible').count(),8);
      await shelf.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
      assert.ok(await shelf.evaluate(el=>el.scrollLeft>0));
      await page.getByRole('button',{name:'Machines',exact:true}).tap();
      assert.equal(await shelf.locator('.browser-card:visible').count(),3);
      await page.getByRole('button',{name:'All',exact:true}).tap();
      assert.deepEqual(errors,[]);
      console.log(`PASS ${width}px touch step and layout: ${path}`);
    }
    await page.getByRole('button',{name:'Gates',exact:true}).tap();
    await page.locator('[data-item="xor"]').tap();
    await page.waitForFunction(()=>document.querySelector('#logic-status')?.textContent==='Ready');
    assert.equal(await page.locator('#logic-gate').inputValue(),'xor');
    assert.equal(await page.locator('.browser-card[aria-current="page"]').getAttribute('data-item'),'xor');
    await page.getByRole('button',{name:'Simple parts',exact:true}).tap();
    await page.locator('[data-item="straight-track"]').tap();
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='Ready');
    assert.equal(await page.locator('#component').inputValue(),'straight-track');
    assert.equal(await page.locator('#mode').inputValue(),'cpu');
    await page.locator('#mode').selectOption('semantic');
    await page.locator('#step').tap();
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='Completed');
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px cross-page gate and primitive selection`);
    await page.close();
  }
} finally {await browser.close();}
