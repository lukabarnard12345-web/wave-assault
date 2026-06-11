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
  await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    L.setTime(0.25); L.mobs.length = 0;
    const X = Math.floor(p.x), Z = Math.floor(p.z), Y = 70;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -8; dz <= 2; dz++) L.setBlock(X + dx, Y, Z + dz, 3);
    // real cobble terrain block on the left, entity test cube on the right, same row
    L.setBlock(X - 2, Y + 1, Z - 4, 4);
    L.testCube = [X + 2 + .5, Y + 1 + .5, Z - 4 + .5];  // unit entity cube centred in the cell
    p.x = X + .5; p.y = Y + 1.01; p.z = Z + .5; p.vx = p.vy = p.vz = 0;
    L.look(0, -0.18);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'cube-compare.png') });
  await browser.close();
  console.log('done');
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
