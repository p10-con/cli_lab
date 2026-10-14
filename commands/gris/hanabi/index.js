// hanabi — ターミナルに打ち上げ花火
// 依存なし。ANSI エスケープ（truecolor）と setInterval だけで描画する。

const FPS = 30;
const DT  = 1 / FPS;
const out = process.stdout;

let cols, rows, skyRows, G;
let skyline = [];   // 各列のビルの高さ
let windows = [];   // 窓の明かり { x, y, on }

function layout() {
  cols = out.columns || 80;
  rows = out.rows    || 24;
  skyRows = rows - 1;              // 最下行はステータス表示
  G = Math.max(8, rows * 0.55);    // 重力（行/秒²）— 画面の高さに合わせて調整
  buildSkyline();
  out.write('\x1b[2J');
}

// ------------------------------------------------------------
//  夜景
// ------------------------------------------------------------
function buildSkyline() {
  skyline = new Array(cols).fill(0);
  windows = [];
  const maxH = Math.max(2, Math.floor(rows * 0.14));
  let x = 0;
  while (x < cols) {
    const w = 3 + ((Math.random() * 6) | 0);
    const h = Math.random() < 0.15 ? 0 : 1 + ((Math.random() * maxH) | 0);
    for (let i = x; i < Math.min(cols, x + w); i++) skyline[i] = h;
    for (let i = x + 1; i < Math.min(cols, x + w) - 1; i += 2) {
      for (let j = 1; j < h; j++) {
        if (Math.random() < 0.35) windows.push({ x: i, y: skyRows - 1 - j, on: Math.random() < 0.7 });
      }
    }
    x += w;
  }
}

// ------------------------------------------------------------
//  色
// ------------------------------------------------------------
const PALETTES = {
  red:    [[255, 70, 80],   [255, 150, 120]],
  gold:   [[255, 200, 90],  [255, 240, 170]],
  green:  [[90, 255, 140],  [190, 255, 200]],
  blue:   [[90, 160, 255],  [180, 210, 255]],
  purple: [[200, 110, 255], [240, 190, 255]],
  pink:   [[255, 110, 200], [255, 200, 235]],
  silver: [[210, 210, 235], [255, 255, 255]],
};
const COLOR_NAMES = Object.keys(PALETTES);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);

function mix([r1, g1, b1], [r2, g2, b2], t) {
  return [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t];
}

// ------------------------------------------------------------
//  粒子
//  ターミナルの1マスは縦長（およそ 1:2）なので、横方向の速度を 2 倍にして真円に見せる
// ------------------------------------------------------------
const rockets   = [];
const particles = [];

function spawn(x, y, vx, vy, opt) {
  particles.push({
    x, y, vx, vy,
    life: opt.life, maxLife: opt.life,
    color: opt.color,
    drag: opt.drag ?? 0.985,
    grav: opt.grav ?? 0.35,
    trail: opt.trail ?? 0,
    hist: [],
    crackle: opt.crackle ?? false,
    onDie: opt.onDie ?? null,
  });
}

function ring(x, y, n, speed, fn) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
    const s = speed * rand(0.85, 1.05);
    fn(Math.cos(a) * s * 2, Math.sin(a) * s);
  }
}

// 球状に見せるため、半径方向の速さにばらつきを持たせる（中心が詰まった円盤）
function sphere(x, y, n, speed, fn) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * Math.sqrt(Math.random()) * rand(0.9, 1.1);
    fn(Math.cos(a) * s * 2, Math.sin(a) * s);
  }
}

const SHELLS = {
  // 菊：尾を引いて広がる、最後にパチパチ
  kiku(x, y) {
    const [c1, c2] = PALETTES[pick(COLOR_NAMES)];
    const sp = rand(9, 13) * (rows / 40);
    sphere(x, y, 90, sp, (vx, vy) => spawn(x, y, vx, vy, {
      life: rand(1.3, 1.9), color: mix(c1, c2, Math.random() * 0.5), trail: 4, crackle: Math.random() < 0.5,
    }));
    return '菊';
  },
  // 牡丹：尾を引かない、くっきりした光の点。二重の輪
  botan(x, y) {
    const outer = PALETTES[pick(COLOR_NAMES)][0];
    const inner = PALETTES[pick(COLOR_NAMES)][1];
    const sp = rand(9, 12) * (rows / 40);
    ring(x, y, 48, sp, (vx, vy) => spawn(x, y, vx, vy, { life: rand(1.1, 1.5), color: outer, drag: 0.96 }));
    ring(x, y, 24, sp * 0.5, (vx, vy) => spawn(x, y, vx, vy, { life: rand(1.0, 1.3), color: inner, drag: 0.96 }));
    return '牡丹';
  },
  // 柳：金色の長い尾が重く垂れ下がる
  yanagi(x, y) {
    const sp = rand(7, 10) * (rows / 40);
    sphere(x, y, 70, sp, (vx, vy) => spawn(x, y, vx, vy - sp * 0.15, {
      life: rand(2.6, 3.4), color: PALETTES.gold[0], drag: 0.95, grav: 0.55, trail: 9,
    }));
    return '柳';
  },
  // 千輪：小さな花がいくつも遅れて咲く
  senrin(x, y) {
    const sp = rand(6, 8) * (rows / 40);
    ring(x, y, 9, sp, (vx, vy) => spawn(x, y, vx, vy, {
      life: rand(0.6, 0.9), color: PALETTES.silver[1], drag: 0.95, trail: 2,
      onDie: (px, py) => {
        const c = PALETTES[pick(COLOR_NAMES)];
        ring(px, py, 14, sp * 0.35, (vx2, vy2) => spawn(px, py, vx2, vy2, {
          life: rand(0.6, 0.9), color: mix(c[0], c[1], 0.3), drag: 0.93,
        }));
      },
    }));
    return '千輪';
  },
  // ハート：型物
  heart(x, y) {
    const c = PALETTES.pink;
    const sp = rand(0.55, 0.7) * (rows / 40);
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      const hx = 16 * Math.sin(t) ** 3;
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      spawn(x, y, hx * sp * 2, hy * sp, { life: 1.6, color: mix(c[0], c[1], Math.random() * 0.4), drag: 0.94, grav: 0.12 });
    }
    return 'ハート';
  },
};

const SHELL_WEIGHTS = [['kiku', 4], ['botan', 3], ['yanagi', 2], ['senrin', 2], ['heart', 1]];
function randomShell() {
  const total = SHELL_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [name, w] of SHELL_WEIGHTS) if ((r -= w) < 0) return name;
  return 'kiku';
}

function launch(shell = randomShell()) {
  const x = rand(cols * 0.12, cols * 0.88);
  const targetY = rand(rows * 0.12, rows * 0.42);
  const y0 = skyRows - 1;
  const vy = -Math.sqrt(2 * G * (y0 - targetY));
  rockets.push({ x, y: y0, vx: rand(-1.5, 1.5), vy, shell, hist: [] });
}

// ------------------------------------------------------------
//  シミュレーション
// ------------------------------------------------------------
let lastShell = '';
let lastShellAt = 0;
let clock = 0;

function step() {
  clock += DT;

  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.hist.unshift([r.x, r.y]);
    if (r.hist.length > 5) r.hist.pop();
    r.x += r.vx * DT;
    r.y += r.vy * DT;
    r.vy += G * DT;
    if (r.vy >= -0.5) {               // 頂点で開花
      lastShell = SHELLS[r.shell](r.x, r.y);
      lastShellAt = clock;
      rockets.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.trail) {
      p.hist.unshift([p.x, p.y]);
      if (p.hist.length > p.trail) p.hist.pop();
    }
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.vy += G * p.grav * DT;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    p.life -= DT;
    if (p.life <= 0) {
      if (p.onDie) p.onDie(p.x, p.y);
      particles.splice(i, 1);
    }
  }

  for (const w of windows) if (Math.random() < 0.0015) w.on = !w.on;
}

// ------------------------------------------------------------
//  描画
// ------------------------------------------------------------
const GLYPHS = ['.', '·', '+', '*', '@'];   // 明るさの順

function render() {
  const n = cols * skyRows;
  const bright = new Float32Array(n);
  const color  = new Array(n);
  const glyph  = new Array(n);

  const plot = (x, y, b, c, g) => {
    const cx = Math.round(x), cy = Math.round(y);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= skyRows) return;
    const idx = cy * cols + cx;
    if (b <= bright[idx]) return;
    bright[idx] = b;
    color[idx] = c;
    glyph[idx] = g;
  };

  for (const r of rockets) {
    r.hist.forEach(([hx, hy], k) => plot(hx, hy, 0.4 - k * 0.07, [255, 190, 120], k < 2 ? ':' : '.'));
    plot(r.x, r.y, 0.9, [255, 230, 190], '|');
  }

  for (const p of particles) {
    const t = Math.max(0, p.life / p.maxLife);
    let b = Math.pow(t, 0.6);
    // 消える間際にパチパチ瞬く
    if (p.crackle && t < 0.3 && Math.random() < 0.5) b = Math.random() < 0.5 ? 0 : 1;
    if (b <= 0) continue;
    const c = t > 0.85 ? mix(p.color, [255, 255, 255], (t - 0.85) / 0.15 * 0.7) : p.color;
    plot(p.x, p.y, b, c, GLYPHS[Math.min(GLYPHS.length - 1, Math.floor(b * GLYPHS.length))]);
    p.hist.forEach(([hx, hy], k) => {
      const tb = b * 0.5 * (1 - k / (p.hist.length + 1));
      plot(hx, hy, tb, p.color, tb > 0.25 ? '·' : '.');
    });
  }

  // 夜景（花火より手前）
  for (let x = 0; x < cols; x++) {
    for (let j = 0; j < skyline[x]; j++) {
      const idx = (skyRows - 1 - j) * cols + x;
      bright[idx] = 1;
      color[idx] = [28, 28, 44];
      glyph[idx] = '█';
    }
  }
  for (const w of windows) {
    if (!w.on) continue;
    const idx = w.y * cols + w.x;
    color[idx] = [140, 120, 60];
    glyph[idx] = '▪';
  }

  let s = '\x1b[H';
  let prev = '';
  for (let y = 0; y < skyRows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      if (!glyph[idx]) {
        s += ' ';
        continue;
      }
      const b = Math.min(1, bright[idx]);
      const [r, g, bl] = color[idx];
      const k = glyph[idx] === '█' || glyph[idx] === '▪' ? 1 : 0.25 + 0.75 * b;
      const code = `\x1b[38;2;${(r * k) | 0};${(g * k) | 0};${(bl * k) | 0}m`;
      if (code !== prev) { s += code; prev = code; }
      s += glyph[idx];
    }
    if (y < skyRows - 1) s += '\n';
  }

  // ステータス行
  const shout = lastShell && clock - lastShellAt < 2 ? `  🎆 ${lastShell}  たーまやー！` : '';
  const help = ' space 打ち上げ · f スターマイン · q 終了';
  s += `\n\x1b[0m\x1b[38;2;90;90;120m${help}\x1b[38;2;220;200;150m${shout}\x1b[0m\x1b[K`;
  out.write(s);
}

// ------------------------------------------------------------
//  自動の打ち上げ & スターマイン
// ------------------------------------------------------------
let nextAuto = 0.5;
let finale = 0;   // 残り発数

function schedule() {
  if (finale > 0) {
    if (Math.random() < 0.45) { launch(); finale--; }
    return;
  }
  nextAuto -= DT;
  if (nextAuto <= 0) {
    launch();
    if (Math.random() < 0.25) launch();     // たまに2発同時
    nextAuto = rand(0.6, 1.8);
  }
}

// ------------------------------------------------------------
//  起動・終了
// ------------------------------------------------------------
const cleanup = () => {
  clearInterval(timer);
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  out.write('\x1b[0m\x1b[2J\x1b[H\x1b[?25h');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
out.on('resize', layout);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', key => {
    if (key === 'q' || key === '\u0003' || key === '\x1b') cleanup();
    else if (key === ' ') launch();
    else if (key === 'f') finale += 24;
    else if (key === 'h') launch('heart');
  });
}

out.write('\x1b[?25l');
layout();

const timer = setInterval(() => {
  schedule();
  step();
  render();
}, 1000 / FPS);
