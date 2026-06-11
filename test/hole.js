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

  const probe = await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    L.setTime(0.25); L.freezeMobs = true; L.mobs.length = 0;
    const X = Math.floor(p.x), Z = Math.floor(p.z), Y = 70;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -8; dz <= 2; dz++) L.setBlock(X + dx, Y, Z + dz, 3);
    L.setBlock(X, Y + 1, Z - 3, 3);
    p.x = X + .5; p.y = Y + 1.01; p.z = Z + .5; p.vx = p.vy = p.vz = 0;
    L.look(0, -0.25);
    // dump a 5x5 sample of the platform layer around the placed block
    const rows = [];
    for (let dz = -5; dz <= -1; dz++) {
      let row = '';
      for (let dx = -2; dx <= 2; dx++) row += L.getBlock(X + dx, Y, Z + dz) + ' ';
      rows.push(`z=${dz}: ${row}`);
    }
    return { X, Z, rows };
  });
  console.log(JSON.stringify(probe, null, 1));
  await page.waitForTimeout(900);
  // look from below the platform: teleport under it
  await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    const X = Math.floor(p.x), Z = Math.floor(p.z);
    p.y = 64; p.x = X + .5; p.z = Z - 2.5; p.vy = 0;
    L.look(0, 1.2);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'hole-below.png') });
  await browser.close();
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
