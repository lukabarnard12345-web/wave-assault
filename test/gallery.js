// Visual QA gallery: every block placed in a row + every mob, screenshotted close-up.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file:///' + path.resolve(__dirname, '..', 'luka-craft.html').replace(/\\/g, '/') + '?seed=12345';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERR:', String(e)));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLEERR:', m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__LC && document.getElementById('start-btn').textContent === 'PLAY');
  await page.evaluate(() => window.__LC.startTest());
  await page.waitForTimeout(1000);

  const shot = async name => page.screenshot({ path: path.join(__dirname, 'shots', name + '.png') });

  // build a stone viewing platform high in the sky, place all block types in a row
  await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    L.setTime(0.25);
    L.mobs.length = 0;
    const X = Math.floor(p.x), Z = Math.floor(p.z), Y = 70;
    for (let dx = -2; dx <= 18; dx++) for (let dz = -6; dz <= 2; dz++)
      L.setBlock(X + dx, Y, Z + dz, 3);
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15]; // all but water/air
    ids.forEach((id, i) => L.setBlock(X + i, Y + 1, Z - 4, id));
    // small water pool with a ledge to watch flow
    L.setBlock(X + 16, Y + 2, Z - 4, 11);
    p.x = X + 6.5; p.y = Y + 1; p.z = Z + 1.5; p.vx = p.vy = p.vz = 0;
    L.look(Math.PI, -0.35); // face -z? forward = (-sin,-cos) → yaw π faces +z... we need to face the row at Z-4: from Z+1.5 looking toward -z → yaw 0 gives forward (0,-1) → -z. good:
    L.look(0, -0.3);
  });
  await page.waitForTimeout(2500);
  await shot('g1-blocks-row');

  // step back for a wider view
  await page.evaluate(() => { const p = window.__LC.player; p.x += 2; p.z += 0; window.__LC.look(0.45, -0.25); });
  await page.waitForTimeout(800);
  await shot('g2-blocks-row-wide');

  // mobs one at a time on the platform
  for (const t of ['pig', 'cow', 'chicken', 'zombie', 'skeleton']) {
    await page.evaluate(type => {
      const L = window.__LC, p = L.player;
      L.mobs.length = 0;
      L.setTime(0.45); // late afternoon: still lit, hostiles don't burn at .45? keep .25 lit but they burn — use .45
      L.look(0, -0.12);
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      const m = L.spawnMob(type, p.x + fx * 3.2, p.y + .1, p.z + fz * 3.2);
      m.yaw = p.yaw + Math.PI;
      m.wanderT = 99; m.wx = 0; m.wz = 0;     // hold still for the photo
    }, t);
    await page.waitForTimeout(350);
    await shot('g3-mob-' + t);
  }

  // water flow check: pool placed earlier should have spread off the ledge
  await page.evaluate(() => {
    const L = window.__LC, p = L.player;
    p.x = Math.floor(p.x) + 12; p.z += 4; window.__LC.look(-0.6, -0.3); L.setTime(.25);
  });
  await page.waitForTimeout(2500);
  await shot('g4-water');

  // first-person: held tool + held block + swing
  await page.evaluate(() => { const L = window.__LC; L.setSlot(1); });
  await shot('g5-held-pick');
  await page.evaluate(() => { const L = window.__LC; L.give(4, 5); for (let i=0;i<9;i++) if (L.player.inv[i].id===4) { L.setSlot(i); break; } });
  await shot('g6-held-block');

  await browser.close();
  console.log('GALLERY DONE');
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
