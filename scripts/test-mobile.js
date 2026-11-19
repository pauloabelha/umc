import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({args:['--enable-unsafe-swiftshader']});
try {
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
      await step.tap();
      await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.id==='step'||b.id==='logic-step'||b.id==='machine-step')?.disabled);
      if(machine) assert.equal(await page.locator('#register-a').textContent(),'1');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow: ${width} ${path}`);
      if(!machine) assert.ok(await page.locator('#viewport canvas').count()>0);
      assert.deepEqual(errors,[]);
      console.log(`PASS ${width}px touch step and layout: ${path}`);
    }
    await page.close();
  }
} finally {await browser.close();}
