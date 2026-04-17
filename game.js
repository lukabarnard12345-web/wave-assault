// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const CANVAS_W = 800;
const CANVAS_H = 600;
const PLAYER_SPEED = 3;
const PLAYER_MAX_HP = 100;
const BULLET_SPEED = 7;
const BULLET_FIRE_RATE = 200;
const ENEMY_BULLET_SPEED = 3;
const INVINCIBLE_DURATION = 1500;
const MELEE_RANGE = 18;
const MELEE_DAMAGE = 8;
const MELEE_COOLDOWN = 600;

const COLORS = {
  bg:           '#0d0d1a',
  bgL2:         '#0d0a1a',
  bgL3:         '#1a0a0a',
  player:       '#00ffcc',
  playerDark:   '#004433',
  bullet:       '#ffff00',
  bulletGlow:   '#ffaa00',
  enemyA:       '#ff4444',
  enemyB:       '#ff8800',
  enemyC:       '#cc00ff',
  enemyBullet:  '#ff0066',
  hpFill:       '#33ff33',
  hpBg:         '#1a1a1a',
  hpBorder:     '#444',
  uiText:       '#ffffff',
  accent:       '#33ff33',
  accentDim:    '#1a8a1a',
  dim:          'rgba(0,0,0,0.6)',
};

// ─── ENEMY TYPES ─────────────────────────────────────────────────────────────
const ENEMY_TYPES = {
  A: { hp: 1, speed: 1.2, size: 16, score: 10,  color: COLORS.enemyA, shootRate: 2500, bulletDmg: 10 },
  B: { hp: 1, speed: 2.5, size: 12, score: 20,  color: COLORS.enemyB, shootRate: 3000, bulletDmg: 8  },
  C: { hp: 4, speed: 0.7, size: 24, score: 50,  color: COLORS.enemyC, shootRate: 1800, bulletDmg: 20 },
};

// ─── LEVELS ───────────────────────────────────────────────────────────────────
const LEVELS = [
  {
    id: 1,
    bgColor: COLORS.bg,
    waves: [
      { count: 5,  type: 'A', spawnInterval: 1500 },
      { count: 8,  type: 'A', spawnInterval: 1200 },
      { count: 6,  type: 'A', spawnInterval: 1000, mix: { B: 2 } },
    ],
  },
  {
    id: 2,
    bgColor: COLORS.bgL2,
    waves: [
      { count: 8,  type: 'A', spawnInterval: 900,  mix: { B: 3 } },
      { count: 6,  type: 'B', spawnInterval: 800 },
      { count: 8,  type: 'A', spawnInterval: 700,  mix: { B: 4, C: 1 } },
    ],
  },
  {
    id: 3,
    bgColor: COLORS.bgL3,
    waves: [
      { count: 10, type: 'B', spawnInterval: 700,  mix: { C: 2 } },
      { count: 8,  type: 'C', spawnInterval: 1000 },
      { count: 12, type: 'A', spawnInterval: 500,  mix: { B: 5, C: 3 } },
    ],
  },
];

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = {};

function freshState() {
  return {
    screen: 'menu',
    score: 0,
    levelIndex: 0,
    waveIndex: 0,
    totalEnemiesInWave: 0,
    enemiesSpawnedInWave: 0,
    enemiesKilledInWave: 0,
    currentWaveConfig: null,
    lastSpawnTime: 0,
    lastFireTime: 0,
    player: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    keys: {},
    waveTransition: false,
    waveTransitionTimer: 0,
    showInstructions: false,
  };
}

state = freshState();

// ─── ENTITY FACTORIES ─────────────────────────────────────────────────────────
function createPlayer() {
  return {
    x: CANVAS_W / 2,
    y: CANVAS_H / 2,
    w: 18,
    h: 18,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    invincible: false,
    invincibleTimer: 0,
    meleeCooldown: 0,
    blinkOn: true,
    blinkTimer: 0,
  };
}

function createEnemy(type) {
  const def = ENEMY_TYPES[type];
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  const margin = def.size + 10;
  if (edge === 0) { x = Math.random() * CANVAS_W; y = -margin; }
  else if (edge === 1) { x = CANVAS_W + margin; y = Math.random() * CANVAS_H; }
  else if (edge === 2) { x = Math.random() * CANVAS_W; y = CANVAS_H + margin; }
  else { x = -margin; y = Math.random() * CANVAS_H; }
  return {
    x, y,
    type,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    size: def.size,
    color: def.color,
    score: def.score,
    shootRate: def.shootRate,
    bulletDmg: def.bulletDmg,
    lastShootTime: Math.random() * def.shootRate,
    flashTimer: 0,
  };
}

function createBullet(x, y, dir) {
  return { x, y, dx: dir.dx * BULLET_SPEED, dy: dir.dy * BULLET_SPEED, w: 4, h: 8 };
}

function createEnemyBullet(enemy, tx, ty, dmg) {
  const angle = Math.atan2(ty - enemy.y, tx - enemy.x);
  return {
    x: enemy.x, y: enemy.y,
    dx: Math.cos(angle) * ENEMY_BULLET_SPEED,
    dy: Math.sin(angle) * ENEMY_BULLET_SPEED,
    dmg,
    w: 5, h: 5,
  };
}

function createParticles(x, y, color, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.8;
    const speed = 1.5 + Math.random() * 3;
    out.push({
      x, y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 1.0,
      color,
      size: 2 + Math.random() * 4,
    });
  }
  return out;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function normalize(dx, dy) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { dx: 0, dy: -1 };
  return { dx: dx / len, dy: dy / len };
}

function findNearestEnemy(player, enemies) {
  let best = null, bestDist = Infinity;
  for (const e of enemies) {
    const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function rectCircle(rx, ry, rw, rh, cx, cy, cr) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  return (cx - nearX) ** 2 + (cy - nearY) ** 2 < cr * cr;
}

function pickEnemyType(wave) {
  const pool = [];
  for (let i = 0; i < wave.count; i++) pool.push(wave.type);
  if (wave.mix) {
    for (const [t, n] of Object.entries(wave.mix)) {
      for (let i = 0; i < n; i++) pool.push(t);
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function waveTotal(wave) {
  let t = wave.count;
  if (wave.mix) t += Object.values(wave.mix).reduce((a, b) => a + b, 0);
  return t;
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  state.keys[e.code] = true;
  if (e.code === 'Enter') handleEnterKey();
  if (e.code === 'KeyI' && state.screen === 'menu') state.showInstructions = !state.showInstructions;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});

document.addEventListener('keyup', e => {
  state.keys[e.code] = false;
});

function handleEnterKey() {
  if (state.screen === 'menu') startGame();
  else if (state.screen === 'gameover' || state.screen === 'win') {
    state.screen = 'menu';
    state.showInstructions = false;
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function startGame() {
  const keys = state.keys;
  state = freshState();
  state.keys = keys;
  state.screen = 'playing';
  state.player = createPlayer();
  initWave();
}

function initWave() {
  const wave = LEVELS[state.levelIndex].waves[state.waveIndex];
  state.totalEnemiesInWave = waveTotal(wave);
  state.enemiesSpawnedInWave = 0;
  state.enemiesKilledInWave = 0;
  state.currentWaveConfig = wave;
  state.lastSpawnTime = performance.now() - wave.spawnInterval;
  state.waveTransition = false;
  state.enemies = [];
  state.bullets = [];
  state.enemyBullets = [];
}

function advanceWave() {
  state.waveIndex++;
  if (state.waveIndex >= LEVELS[state.levelIndex].waves.length) {
    state.levelIndex++;
    if (state.levelIndex >= LEVELS.length) {
      state.screen = 'win';
    } else {
      state.waveIndex = 0;
      state.waveTransition = true;
      state.waveTransitionTimer = 2000;
    }
  } else {
    state.waveTransition = true;
    state.waveTransitionTimer = 1500;
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
function update(dt, timestamp) {
  if (state.waveTransition) {
    state.waveTransitionTimer -= dt;
    updateParticles(dt);
    if (state.waveTransitionTimer <= 0) {
      state.waveTransition = false;
      initWave();
    }
    return;
  }

  updatePlayer(dt);
  autoFire(timestamp);
  spawnTick(timestamp);
  updateBullets(dt);
  updateEnemies(dt, timestamp);
  updateEnemyBullets(dt);
  updateParticles(dt);
  checkWaveProgress();
}

function updatePlayer(dt) {
  const p = state.player;
  if (state.keys['KeyW'] || state.keys['ArrowUp'])    p.y -= PLAYER_SPEED;
  if (state.keys['KeyS'] || state.keys['ArrowDown'])  p.y += PLAYER_SPEED;
  if (state.keys['KeyA'] || state.keys['ArrowLeft'])  p.x -= PLAYER_SPEED;
  if (state.keys['KeyD'] || state.keys['ArrowRight']) p.x += PLAYER_SPEED;

  p.x = Math.max(p.w / 2, Math.min(CANVAS_W - p.w / 2, p.x));
  p.y = Math.max(p.h / 2, Math.min(CANVAS_H - p.h / 2, p.y));

  if (p.invincible) {
    p.invincibleTimer -= dt;
    p.blinkTimer -= dt;
    if (p.blinkTimer <= 0) { p.blinkOn = !p.blinkOn; p.blinkTimer = 120; }
    if (p.invincibleTimer <= 0) { p.invincible = false; p.blinkOn = true; }
  }

  if (p.meleeCooldown > 0) p.meleeCooldown -= dt;
}

function autoFire(timestamp) {
  if (state.enemies.length === 0) return;
  if (timestamp - state.lastFireTime < BULLET_FIRE_RATE) return;
  const p = state.player;
  const nearest = findNearestEnemy(p, state.enemies);
  const dir = normalize(nearest.x - p.x, nearest.y - p.y);
  state.bullets.push(createBullet(p.x, p.y, dir));
  state.lastFireTime = timestamp;
}

function spawnTick(timestamp) {
  const wave = state.currentWaveConfig;
  if (!wave) return;
  if (state.enemiesSpawnedInWave >= state.totalEnemiesInWave) return;
  if (timestamp - state.lastSpawnTime < wave.spawnInterval) return;
  state.enemies.push(createEnemy(pickEnemyType(wave)));
  state.enemiesSpawnedInWave++;
  state.lastSpawnTime = timestamp;
}

function updateBullets(dt) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.dx;
    b.y += b.dy;
    if (b.x < -10 || b.x > CANVAS_W + 10 || b.y < -10 || b.y > CANVAS_H + 10) {
      state.bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (rectCircle(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, e.x, e.y, e.size)) {
        e.hp--;
        e.flashTimer = 100;
        if (e.hp <= 0) {
          state.score += e.score;
          state.particles.push(...createParticles(e.x, e.y, e.color, 8));
          state.enemies.splice(j, 1);
          state.enemiesKilledInWave++;
        }
        hit = true;
        break;
      }
    }
    if (hit) state.bullets.splice(i, 1);
  }
}

function updateEnemies(dt, timestamp) {
  const p = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dir = normalize(dx, dy);
    e.x += dir.dx * e.speed;
    e.y += dir.dy * e.speed;

    if (e.flashTimer > 0) e.flashTimer -= dt;

    // melee attack on player
    if (dist < e.size + MELEE_RANGE && p.meleeCooldown <= 0 && !p.invincible) {
      hitPlayer(MELEE_DAMAGE);
      p.meleeCooldown = MELEE_COOLDOWN;
    }

    // ranged attack
    if (timestamp - e.lastShootTime > e.shootRate) {
      state.enemyBullets.push(createEnemyBullet(e, p.x, p.y, e.bulletDmg));
      e.lastShootTime = timestamp;
    }
  }
}

function updateEnemyBullets(dt) {
  const p = state.player;
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const b = state.enemyBullets[i];
    b.x += b.dx;
    b.y += b.dy;
    if (b.x < -10 || b.x > CANVAS_W + 10 || b.y < -10 || b.y > CANVAS_H + 10) {
      state.enemyBullets.splice(i, 1);
      continue;
    }
    if (!p.invincible && rectCircle(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, p.x, p.y, p.w * 0.6)) {
      hitPlayer(b.dmg);
      state.enemyBullets.splice(i, 1);
    }
  }
}

function hitPlayer(dmg) {
  const p = state.player;
  p.hp = Math.max(0, p.hp - dmg);
  p.invincible = true;
  p.invincibleTimer = INVINCIBLE_DURATION;
  p.blinkTimer = 120;
  p.blinkOn = false;
  if (p.hp <= 0) state.screen = 'gameover';
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.dx *= 0.95;
    p.dy *= 0.95;
    p.life -= dt / 600;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function checkWaveProgress() {
  if (state.enemiesSpawnedInWave >= state.totalEnemiesInWave && state.enemies.length === 0) {
    if (!state.waveTransition && state.screen === 'playing') {
      advanceWave();
    }
  }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function render() {
  const bgColor = LEVELS[state.levelIndex] ? LEVELS[state.levelIndex].bgColor : COLORS.bg;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  renderParticles();
  renderEnemyBullets();
  renderBullets();
  renderEnemies();
  renderPlayer();
  renderHUD();
  renderScanlines();

  if (state.waveTransition) {
    renderWaveTransition();
  }
}

function renderPlayer() {
  const p = state.player;
  if (!p.blinkOn) return;

  ctx.save();
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 12;
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);

  // barrel direction indicator
  const nearest = findNearestEnemy(p, state.enemies);
  let angle = -Math.PI / 2;
  if (nearest) angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);

  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(angle) * 16, p.y + Math.sin(angle) * 16);
  ctx.stroke();

  ctx.restore();
}

function renderEnemies() {
  for (const e of state.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);

    const flash = e.flashTimer > 0;
    const col = flash ? '#ffffff' : e.color;

    if (e.type === 'A') {
      ctx.fillStyle = col;
      ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
    } else if (e.type === 'B') {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = col;
      ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
    } else if (e.type === 'C') {
      ctx.fillStyle = col;
      ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
      ctx.fillStyle = flash ? '#aaaaaa' : '#660099';
      ctx.fillRect(-e.size * 0.5, -e.size * 0.5, e.size, e.size);
    }

    // HP bar above enemy (for C type)
    if (e.type === 'C' && e.hp < e.maxHp) {
      const barW = e.size * 2;
      const barH = 4;
      const by = -e.size - 8;
      ctx.fillStyle = '#333';
      ctx.fillRect(-e.size, by, barW, barH);
      ctx.fillStyle = '#ff44ff';
      ctx.fillRect(-e.size, by, barW * (e.hp / e.maxHp), barH);
    }

    ctx.restore();
  }
}

function renderBullets() {
  ctx.save();
  ctx.shadowColor = COLORS.bulletGlow;
  ctx.shadowBlur = 6;
  ctx.fillStyle = COLORS.bullet;
  for (const b of state.bullets) {
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  ctx.restore();
}

function renderEnemyBullets() {
  ctx.fillStyle = COLORS.enemyBullet;
  for (const b of state.enemyBullets) {
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
}

function renderParticles() {
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }
}

function renderHUD() {
  const p = state.player;

  // HP bar
  const barX = 16, barY = 16, barW = 180, barH = 16;
  ctx.fillStyle = COLORS.hpBg;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = COLORS.hpFill;
  ctx.fillRect(barX, barY, barW * (p.hp / p.maxHp), barH);
  ctx.strokeStyle = COLORS.hpBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = COLORS.uiText;
  ctx.font = '10px monospace';
  ctx.fillText(`HP ${p.hp}/${p.maxHp}`, barX + 4, barY + 12);

  // Level / wave / score
  const level = LEVELS[state.levelIndex];
  const totalWaves = level ? level.waves.length : 0;
  ctx.font = '12px monospace';
  ctx.fillStyle = COLORS.accent;
  ctx.textAlign = 'right';
  ctx.fillText(`LEVEL ${state.levelIndex + 1}  WAVE ${state.waveIndex + 1}/${totalWaves}  SCORE: ${state.score}`, CANVAS_W - 16, 28);
  ctx.textAlign = 'left';
}

function renderWaveTransition() {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();

  const isNewLevel = state.waveTransitionTimer > 1700;
  const msg = isNewLevel
    ? `LEVEL ${state.levelIndex + 1}`
    : `WAVE ${state.waveIndex + 1}`;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 36px monospace';
  ctx.fillText(msg, CANVAS_W / 2, CANVAS_H / 2 - 10);
  ctx.font = '16px monospace';
  ctx.fillStyle = COLORS.uiText;
  ctx.fillText('GET READY...', CANVAS_W / 2, CANVAS_H / 2 + 24);
  ctx.textAlign = 'left';
  ctx.restore();
}

function renderScanlines() {
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < CANVAS_H; y += 4) {
    ctx.fillRect(0, y, CANVAS_W, 1);
  }
  ctx.restore();
}

// ─── SCREEN RENDERERS ─────────────────────────────────────────────────────────
function renderMenu() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 20;
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 56px monospace';
  ctx.fillText('WAVE ASSAULT', CANVAS_W / 2, 140);
  ctx.restore();

  // subtitle
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.accentDim;
  ctx.font = '14px monospace';
  ctx.fillText('TOP-DOWN SHOOTER', CANVAS_W / 2, 172);
  ctx.restore();

  // decorative line
  ctx.strokeStyle = COLORS.accentDim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 190);
  ctx.lineTo(600, 190);
  ctx.stroke();

  if (!state.showInstructions) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.uiText;
    ctx.font = '16px monospace';
    ctx.fillText('PRESS  ENTER  TO  START', CANVAS_W / 2, 260);
    ctx.font = '12px monospace';
    ctx.fillStyle = COLORS.accentDim;
    ctx.fillText('PRESS  I  FOR  INSTRUCTIONS', CANVAS_W / 2, 300);
    ctx.restore();

    // legend
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.font = '11px monospace';
    ctx.fillText(`3 LEVELS  ·  3 WAVES EACH  ·  SURVIVE THEM ALL`, CANVAS_W / 2, 420);
    ctx.restore();
  } else {
    const lines = [
      'CONTROLS',
      '',
      'WASD / ARROW KEYS  -  MOVE',
      'GUN AUTO-FIRES AT NEAREST ENEMY',
      '',
      'ENEMIES',
      '',
      '[ RED SQUARE ]     BASIC    10 PTS',
      '< ORANGE DIAMOND > FAST     20 PTS',
      '[ PURPLE TANK ]    ARMORED  50 PTS',
      '',
      'SURVIVE ALL 3 WAVES TO ADVANCE',
      'CLEAR 3 LEVELS TO WIN',
      '',
      'PRESS  I  TO  GO  BACK',
    ];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '12px monospace';
    lines.forEach((line, i) => {
      if (line === 'CONTROLS' || line === 'ENEMIES') {
        ctx.fillStyle = COLORS.accent;
        ctx.font = 'bold 13px monospace';
      } else {
        ctx.fillStyle = COLORS.uiText;
        ctx.font = '12px monospace';
      }
      ctx.fillText(line, CANVAS_W / 2, 220 + i * 20);
    });
    ctx.restore();
  }

  renderScanlines();
}

function renderGameOver() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#200000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff2222';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('GAME OVER', CANVAS_W / 2, 220);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.uiText;
  ctx.font = '20px monospace';
  ctx.fillText(`SCORE:  ${state.score}`, CANVAS_W / 2, 300);
  ctx.font = '14px monospace';
  ctx.fillStyle = COLORS.accentDim;
  ctx.fillText(`LEVEL ${state.levelIndex + 1}  ·  WAVE ${state.waveIndex + 1}`, CANVAS_W / 2, 336);
  ctx.font = '16px monospace';
  ctx.fillStyle = COLORS.uiText;
  ctx.fillText('PRESS  ENTER  TO  CONTINUE', CANVAS_W / 2, 400);
  ctx.restore();

  renderScanlines();
}

function renderWin() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#001a00';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 30;
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 64px monospace';
  ctx.fillText('YOU  WIN!', CANVAS_W / 2, 210);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.uiText;
  ctx.font = '20px monospace';
  ctx.fillText(`FINAL SCORE:  ${state.score}`, CANVAS_W / 2, 295);
  ctx.font = '14px monospace';
  ctx.fillStyle = COLORS.accentDim;
  ctx.fillText('ALL WAVES DEFEATED', CANVAS_W / 2, 330);
  ctx.font = '16px monospace';
  ctx.fillStyle = COLORS.uiText;
  ctx.fillText('PRESS  ENTER  TO  PLAY  AGAIN', CANVAS_W / 2, 400);
  ctx.restore();

  renderScanlines();
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────
let lastTimestamp = 0;

function loop(timestamp) {
  const dt = Math.min(timestamp - lastTimestamp, 100);
  lastTimestamp = timestamp;

  if (state.screen === 'playing') {
    update(dt, timestamp);
    render();
  } else if (state.screen === 'menu') {
    renderMenu();
  } else if (state.screen === 'gameover') {
    renderGameOver();
  } else if (state.screen === 'win') {
    renderWin();
  }

  requestAnimationFrame(loop);
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
requestAnimationFrame(loop);
