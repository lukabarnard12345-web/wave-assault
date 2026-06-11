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
  await page.waitForTimeout(800);

  // state BEFORE platform
  console.log('before:', await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    return JSON.stringify({ pos: [p.x|0, p.y|0, p.z|0], chunks: L.chunkCount });
  }));
  await page.screenshot({ path: path.join(__dirname, 'shots', 'd0-before.png') });

  // platform only, NO water
  await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    L.setTime(0.25); L.mobs.length = 0;
    const X = Math.floor(p.x), Z = Math.floor(p.z), Y = 70;
    for (let dx = -2; dx <= 18; dx++) for (let dz = -6; dz <= 2; dz++) L.setBlock(X + dx, Y, Z + dz, 3);
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15];
    ids.forEach((id, i) => L.setBlock(X + i, Y + 1, Z - 4, id));
    p.x = X + 6.5; p.y = Y + 1.01; p.z = Z + 1.5; p.vx = p.vy = p.vz = 0;
    L.look(0, -0.3);
  });
  await page.waitForTimeout(2000);
  console.log('after platform:', await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    let water = 0;
    return JSON.stringify({
      pos: [p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1)],
      feetBlock: L.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)),
      eyeBlock: L.getBlock(Math.floor(p.x), Math.floor(p.y + 1.62), Math.floor(p.z)),
      belowBlock: L.getBlock(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z)),
      headInWater: p.headInWater,
      time: L.getTime().toFixed(3),
    });
  }));
  await page.screenshot({ path: path.join(__dirname, 'shots', 'd1-platform.png') });
  await browser.close();
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
