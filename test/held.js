const { chromium } = require('playwright');
const path = require('path');
const URL = 'file:///' + path.resolve(__dirname, '..', 'luka-craft.html').replace(/\\/g, '/') + '?seed=12345';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERR:', String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__LC && document.getElementById('start-btn').textContent === 'PLAY');
  await page.evaluate(() => window.__LC.startTest());
  await page.waitForTimeout(600);
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', n + '.png') });

  await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    L.setTime(0.25); L.freezeMobs = true; L.mobs.length = 0;
    const X = Math.floor(p.x), Z = Math.floor(p.z), Y = 70;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -8; dz <= 2; dz++) L.setBlock(X + dx, Y, Z + dz, 3);
    L.setBlock(X, Y + 1, Z - 3, 3); // stone block to mine (slow barehand → crack stages visible)
    p.x = X + .5; p.y = Y + 1.01; p.z = Z + .5; p.vx = p.vy = p.vz = 0;
    L.look(0, -0.25);
    L.setSlot(1); // wooden pick
  });
  await page.waitForTimeout(400);
  await shot('h1-held-pick');

  await page.evaluate(() => { const L = window.__LC; L.give(4, 8); for (let i=0;i<9;i++) if (L.player.inv[i].id===4) { L.setSlot(i); break; } });
  await page.waitForTimeout(300);
  await shot('h2-held-block');

  // empty hand + mine the stone: capture mid-crack with swing
  await page.evaluate(() => { const L = window.__LC; L.setSlot(8); L.look(0, -0.12); L.mouse(true); });
  await page.waitForTimeout(1600);
  await shot('h3-crack-swing');
  await page.evaluate(() => window.__LC.mouse(false));
  console.log('breaking state:', await page.evaluate(() => JSON.stringify(window.__LC.breaking)));
  await browser.close();
  console.log('done');
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
