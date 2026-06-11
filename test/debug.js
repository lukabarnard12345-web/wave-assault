const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 'file:///' + path.resolve(__dirname, '..', 'luka-craft.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERR:', String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__LC && document.getElementById('start-btn').textContent === 'PLAY');

  // save atlas image for visual inspection
  const dataURL = await page.evaluate(() => window.__LC.atlasURL);
  fs.writeFileSync(path.join(__dirname, 'shots', 'atlas.png'), Buffer.from(dataURL.split(',')[1], 'base64'));
  console.log('atlas saved');

  await page.evaluate(() => window.__LC.startTest());
  await page.waitForTimeout(1500);

  const probe = await page.evaluate(async () => {
    const L = window.__LC, p = L.player;
    L.setTime(0.25);
    L.look(0, -0.9);
    const out = [];
    L.mouse(true);
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 100));
      const b = L.breaking, hit = L.raycast(5);
      out.push({
        i,
        breaking: b ? { x: b.x, y: b.y, z: b.z, prog: +b.prog.toFixed(3), total: +b.total.toFixed(3) } : null,
        hit: hit ? [hit.x, hit.y, hit.z, hit.block] : null,
        py: +p.y.toFixed(3),
      });
    }
    L.mouse(false);
    return out;
  });
  for (const s of probe) if (s.i % 4 === 0 || !s.breaking) console.log(JSON.stringify(s));
  await browser.close();
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
