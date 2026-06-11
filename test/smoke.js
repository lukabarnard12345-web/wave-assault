// Headless smoke test for luka-craft.html — captures screenshots + asserts no console errors.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const URL = 'file:///' + path.resolve(__dirname, '..', 'luka-craft.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(URL);
  await page.waitForFunction(() => window.__LC && document.getElementById('start-btn').textContent === 'PLAY', null, { timeout: 20000 });
  console.log('world ready, seed =', await page.evaluate(() => window.__LC.seed));

  await page.evaluate(() => window.__LC.startTest());
  await page.waitForTimeout(2500); // let meshes build

  const shot = async name => { await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') }); console.log('shot:', name); };
  const ev = (fn, arg) => page.evaluate(fn, arg);

  // 1 ── daytime terrain
  await ev(() => { window.__LC.setTime(0.25); window.__LC.look(0.5, -0.15); });
  await page.waitForTimeout(800);
  await shot('01-day-terrain');

  // walk forward a bit (physics sanity)
  const p0 = await ev(() => ({ x: window.__LC.player.x, z: window.__LC.player.z }));
  await ev(() => window.__LC.key('KeyW', true));
  await page.waitForTimeout(1200);
  await ev(() => window.__LC.key('KeyW', false));
  const p1 = await ev(() => ({ x: window.__LC.player.x, z: window.__LC.player.z, y: window.__LC.player.y, hp: window.__LC.player.health }));
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  console.log('moved:', moved.toFixed(2), 'pos y:', p1.y.toFixed(1), 'hp:', p1.hp);

  // 2 ── spawn all mobs in front of the player and look at them
  await ev(() => {
    const L = window.__LC, p = L.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let i = 0;
    for (const t of ['pig', 'cow', 'chicken', 'zombie', 'skeleton']) {
      const d = 4 + i * 2.2;
      const x = p.x + fx * d + (i - 2) * 1.6, z = p.z + fz * d;
      L.spawnMob(t, x, L.groundY(x, z), z);
      i++;
    }
    L.look(p.yaw, -0.1);
  });
  await page.waitForTimeout(600);
  await shot('02-mobs');

  // 3 ── combat: hit a pig at point-blank range
  const combat = await ev(() => {
    const L = window.__LC, p = L.player;
    L.freezeMobs = true;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const m = L.spawnMob('pig', p.x + fx * 2.2, p.y, p.z + fz * 2.2);
    const dx = m.x - p.x, dz = m.z - p.z;
    p.yaw = Math.atan2(-dx, -dz);
    p.pitch = Math.atan2((m.y + 0.45) - (p.y + p.eye), Math.hypot(dx, dz));
    p.attackCd = 0;
    const before = m.hp;
    L.attack();
    L.freezeMobs = false;
    return { ok: true, before, after: m.hp, panic: m.panic > 0 };
  });
  console.log('combat:', JSON.stringify(combat));
  await page.waitForTimeout(400);
  await shot('03-combat');

  // 4 ── break a block below the line of sight + collect drop
  const mine = await ev(() => {
    const L = window.__LC;
    L.mobs.length = 0; L.freezeMobs = true;   // keep mobs out of the swing path
    L.look(L.player.yaw, -0.9);
    const hit = L.raycast(5);
    if (!hit) return { ok: false };
    const t0 = { x: hit.x, y: hit.y, z: hit.z, block: hit.block };
    L.mouse(true);
    return { ok: true, ...t0 };
  });
  console.log('mining target:', JSON.stringify(mine));
  await page.waitForTimeout(900);
  await shot('04-mining');
  await page.waitForTimeout(2000);
  const mined = await ev(t => window.__LC.getBlock(t.x, t.y, t.z), mine);
  await ev(() => { window.__LC.mouse(false); window.__LC.freezeMobs = false; });
  console.log('block after mining:', mined, '(0 = AIR, ok)');
  console.log('drops in world:', await ev(() => window.__LC.drops.length),
              'inventory:', await ev(() => JSON.stringify(window.__LC.player.inv.filter(s => s.n > 0))));

  // 5 ── place a block: give cobble, look down, place
  await ev(() => {
    const L = window.__LC;
    L.give(4, 10); // BL.COBBLE
    for (let i = 0; i < 9; i++) if (L.player.inv[i].id === 4) { L.setSlot(i); break; }
    L.look(L.player.yaw, -0.7);
    L.useItem();
  });
  await page.waitForTimeout(300);
  await shot('05-place');

  // 6 ── night + hostiles
  await ev(() => { window.__LC.setTime(0.72); window.__LC.look(2.5, 0.05); });
  await page.waitForTimeout(1200);
  await shot('06-night');

  // 7 ── underwater: teleport into ocean
  const uw = await ev(() => {
    const L = window.__LC, p = L.player;
    // search for a water column
    for (let r = 8; r < 70; r += 4) for (let a = 0; a < 6.28; a += 0.4) {
      const x = Math.floor(p.x + Math.sin(a) * r), z = Math.floor(p.z + Math.cos(a) * r);
      const g = L.groundY(x, z);
      if (g > 0 && g < 30) {     // sea floor below 30 → deep enough water column
        p.x = x + 0.5; p.y = g + 1; p.z = z + 0.5; p.vx = p.vy = p.vz = 0;
        return { found: true, x, z, floor: g };
      }
    }
    // no ocean nearby: dig a pool at the player's feet and fill with sources
    const px = Math.floor(p.x), pz = Math.floor(p.z), gy = L.groundY(px, pz);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      for (let dy = 1; dy <= 4; dy++) L.setBlock(px + dx, gy - dy, pz + dz, 0);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      for (let dy = 1; dy <= 4; dy++) L.setBlock(px + dx, gy - dy, pz + dz, 11);
    p.x = px + .5; p.y = gy - 4; p.z = pz + .5; p.vx = p.vy = p.vz = 0;
    return { found: true, dug: true, x: px, z: pz };
  });
  console.log('underwater tp:', JSON.stringify(uw));
  await ev(() => window.__LC.setTime(0.25));
  await page.waitForTimeout(1500);
  await shot('07-underwater');
  console.log('air:', await ev(() => window.__LC.player.air.toFixed(1)),
              'inWater:', await ev(() => window.__LC.player.headInWater));

  // 8 ── death + respawn
  await ev(() => { window.__LC.player.hurtCd = 0; window.__LC.damage(100); });
  await page.waitForTimeout(500);
  await shot('08-death');
  await page.evaluate(() => document.getElementById('respawn-btn').click());
  await page.waitForTimeout(800);
  const afterRespawn = await ev(() => ({ hp: window.__LC.player.health, dead: window.__LC.player.dead }));
  console.log('after respawn:', JSON.stringify(afterRespawn));
  await shot('09-respawn');

  // FPS
  const fps = await ev(() => window.__LC.fps);
  console.log('fps:', fps.toFixed(1));

  console.log('console errors:', errors.length);
  errors.slice(0, 10).forEach(e => console.log('  ERR:', e));
  await browser.close();
  if (errors.length) process.exit(1);
  console.log('SMOKE OK');
})().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
