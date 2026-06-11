// Dump per-part world transforms for a pig at the origin, yaw 0 — verify the math numerically.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file:///' + path.resolve(__dirname, '..', 'luka-craft.html').replace(/\\/g, '/') + '?seed=12345';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERR:', String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__LC && document.getElementById('start-btn').textContent === 'PLAY');
  const out = await page.evaluate(() => {
    const { mIdent, mTrans, mRotX, mRotY, mScale } = window.__LC.mat;
    const def = window.__LC.defs.cow;
    const res = [];
    let base = mTrans(mIdent(), 0, 0, 0);
    base = mRotY(base, 0);
    const sw = 0;
    for (const part of def.parts) {
      let pm = mTrans(base, part.at[0], part.at[1], part.at[2]);
      const ang = (part.rotX0 || 0) + (part.swing ? sw * part.swing : 0);
      if (ang) {
        pm = mTrans(pm, 0, part.pivot || 0, 0);
        pm = mRotX(pm, ang);
        pm = mTrans(pm, 0, -(part.pivot || 0), 0);
      }
      pm = mScale(pm, part.sz[0], part.sz[1], part.sz[2]);
      // world centre = M * (0,0,0,1); world extents = column lengths / 2
      res.push({
        at: part.at, sz: part.sz,
        centre: [pm[12], pm[13], pm[14]].map(v => +v.toFixed(3)),
        xAxis: [pm[0], pm[1], pm[2]].map(v => +v.toFixed(3)),
        yAxis: [pm[4], pm[5], pm[6]].map(v => +v.toFixed(3)),
        zAxis: [pm[8], pm[9], pm[10]].map(v => +v.toFixed(3)),
        w: [pm[3], pm[7], pm[11], pm[15]].map(v => +v.toFixed(3)),
      });
    }
    return res;
  });
  for (const r of out) console.log(JSON.stringify(r));
  await browser.close();
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
