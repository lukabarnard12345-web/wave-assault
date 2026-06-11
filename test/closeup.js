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
  await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    L.setTime(0.18); L.mobs.length = 0;
    const X = Math.floor(p.x), Z = Math.floor(p.z), Y = 70;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -6; dz <= 2; dz++) L.setBlock(X + dx, Y, Z + dz, 3);
    p.x = X + .5; p.y = Y + 1.01; p.z = Z + .5; p.vx = p.vy = p.vz = 0;
    L.look(0, -0.15);
    const m = L.spawnMob('zombie', X + .5, Y + 1.1, Z - 2.2);
    m.yaw = Math.PI; m.wanderT = 99;
    const m2 = L.spawnMob('pig', X + 2.2, Y + 1.1, Z - 2.2);
    m2.yaw = Math.PI; m2.wanderT = 99;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'close-mobs.png') });
  await browser.close();
  console.log('done');
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
