/**
 * aurora — カラフルなオーロラ ASCII アニメーション
 * Node.js 18+ 標準ライブラリのみ使用
 */

// ─── ターミナルサイズ ────────────────────────────────────────────────────────
const COLS = process.stdout.columns || 80;
const ROWS = process.stdout.rows    || 24;

// ─── ASCII グリフ（暗→明）────────────────────────────────────────────────────
const CHARS = ['·', ':', '╎', '│', '┃', '║', '█'];

function brightnessToChar(b) {
  return CHARS[Math.min(CHARS.length - 1, Math.floor(b * CHARS.length * 1.1))];
}

// ─── 1D スムーズノイズ（縦レイ構造用）───────────────────────────────────────
function smoothNoise1D(p) {
  const i  = Math.floor(p);
  const f  = p - i;
  const u  = f * f * (3 - 2 * f);
  const s0 = Math.sin(i       * 127.1 + 311.7) * 43758.5453;
  const s1 = Math.sin((i + 1) * 127.1 + 311.7) * 43758.5453;
  return (s0 - Math.floor(s0)) * (1 - u) + (s1 - Math.floor(s1)) * u;
}

// ─── オーロラ形状 ─────────────────────────────────────────────────────────────
function auroraCenter(nx, t) {
  return 0.65  // 画面下寄りに配置して上方向に広がる余地を作る
    + 0.09 * Math.sin(nx * 3.8  + t * 0.22)
    + 0.06 * Math.sin(nx * 8.1  + t * 0.38 + 1.3)
    + 0.04 * Math.sin(nx * 14.7 + t * 0.55 + 2.7)
    + 0.02 * Math.sin(nx * 26.3 + t * 0.30 + 0.5);
}

function auroraHalfWidth(nx, t) {
  return 0.09  // 帯を細くして下端をくっきりさせる
    + 0.03 * Math.sin(nx * 5.5 + t * 0.14 + 3.0)
    + 0.02 * Math.sin(nx * 9.3 + t * 0.23 + 1.8);
}

function rayIntensity(nx, t) {
  const n1 = smoothNoise1D(nx * 40 + t * 0.10);
  const n2 = smoothNoise1D(nx * 18 + t * 0.15 + 5.3);
  const n3 = smoothNoise1D(nx *  8 + t * 0.06 + 2.1);
  const n4 = smoothNoise1D(nx *  3 + t * 0.04 + 8.7);
  return n1 * 0.44 + n2 * 0.28 + n3 * 0.18 + n4 * 0.10;
}

// ─── 3層オーロラカーテン（視差で立体感）─────────────────────────────────────
// ts=時間スケール, yo=Y中心オフセット, ws=帯幅スケール, maxBri=最大輝度, phase=位相
// hShift: 層ごとの色相オフセット（遠景=青緑、近景=黄緑で前後感を演出）
const AURORA_LAYERS = [
  { ts: 0.55, yo: -0.08, ws: 0.75, maxBri: 0.40, phase: 0.0, hShift: +0.10 }, // 遠景: 青緑
  { ts: 1.00, yo:  0.00, ws: 1.00, maxBri: 0.72, phase: 2.3, hShift:  0.00 }, // 中景: 緑
  { ts: 1.55, yo:  0.10, ws: 1.20, maxBri: 1.00, phase: 5.1, hShift: -0.08 }, // 近景: 黄緑
];

function layerEnv(normDy) {
  const above = Math.max(0, -normDy);
  const below = Math.max(0,  normDy);
  // 上方向: 指数減衰でぼわーっと広がる（ガウシアンだと急に消える）
  // 下方向: 急なガウシアンで下端をくっきりカットオフ
  return Math.exp(-above * 1.1) * Math.exp(-(below ** 2) * 9.0);
}

// 輝度と各層の色を1パスで合成して返す
function auroraCell(x, y, t) {
  const nx = x / COLS;
  const ny = y / ROWS;
  let total = 0;
  let rAcc = 0, gAcc = 0, bAcc = 0, wAcc = 0;

  for (const layer of AURORA_LAYERS) {
    const lt     = t * layer.ts + layer.phase;
    const center = auroraCenter(nx, lt) + layer.yo;
    const halfW  = auroraHalfWidth(nx, lt) * layer.ws;
    const nd     = (ny - center) / halfW;
    const env    = layerEnv(nd);
    const rays   = rayIntensity(nx, lt);
    const pulse  = 0.80 + 0.20 * Math.sin(lt * 1.1 + nx * 5.3);
    const w      = env * layer.maxBri;

    total += w * (0.35 + rays * 0.65) * pulse;

    // 層ごとの色相で色を計算し、輝度重み付きで合成
    const hue = ((auroraHue(nd) + layer.hShift) % 1 + 1) % 1;
    const [lr, lg, lb] = hslToRgb(hue, 0.70, 0.38);
    rAcc += lr * w;
    gAcc += lg * w;
    bAcc += lb * w;
    wAcc += w;
  }

  return {
    bri: Math.min(1, total),
    r:   wAcc > 0.001 ? Math.round(rAcc / wAcc) : 8,
    g:   wAcc > 0.001 ? Math.round(gAcc / wAcc) : 10,
    b:   wAcc > 0.001 ? Math.round(bAcc / wAcc) : 16,
  };
}

// ─── HSL → RGB ────────────────────────────────────────────────────────────────
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  const hi = Math.floor(h * 6) % 6;
  if      (hi === 0) { r = c; g = x; b = 0; }
  else if (hi === 1) { r = x; g = c; b = 0; }
  else if (hi === 2) { r = 0; g = c; b = x; }
  else if (hi === 3) { r = 0; g = x; b = c; }
  else if (hi === 4) { r = x; g = 0; b = c; }
  else               { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// 高度位置 → 色相（緑=帯中心、赤=上方、青紫=下方）
function auroraHue(normDy) {
  if (normDy < 0) {
    const k = Math.min(1, -normDy * 1.1);
    return 0.33 - k * 0.33; // 緑 → 赤
  }
  const k = Math.min(1, normDy * 1.1);
  return 0.33 + k * 0.40;   // 緑 → 青紫
}

// ─── フレームレンダリング ─────────────────────────────────────────────────────
function renderFrame(t) {
  let out = '\x1b[H';

  for (let row = 0; row < ROWS - 1; row++) {
    for (let col = 0; col < COLS; col++) {
      const { bri, r, g, b } = auroraCell(col, row, t);

      if (bri < 0.008) {
        out += '\x1b[38;2;8;10;16m \x1b[0m';
        continue;
      }

      // 暗い端ほど背景色(8,10,16)に向かってブレンド → 黒に溶け込む
      const fade = Math.min(1, bri * 5);
      const fr = Math.round(r * fade + 8  * (1 - fade));
      const fg = Math.round(g * fade + 10 * (1 - fade));
      const fb = Math.round(b * fade + 16 * (1 - fade));
      const ch = brightnessToChar(bri);

      out += `\x1b[38;2;${fr};${fg};${fb}m${ch}\x1b[0m`;
    }
    if (row < ROWS - 2) out += '\n';
  }

  out += `\x1b[${ROWS};1H\x1b[38;2;60;70;90m Ctrl+C で終了\x1b[0m`;
  process.stdout.write(out);
}

// ─── 状態 ────────────────────────────────────────────────────────────────────
let t = 0;

// ─── クリーンアップ ──────────────────────────────────────────────────────────
function cleanup() {
  process.stdout.write('\x1b[?25h\x1b[2J\x1b[H\x1b[0m\x1b[?1049l');
  process.exit(0);
}
process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);

// ─── 入力処理（Ctrl+C のみ）──────────────────────────────────────────────────
process.stdin.resume();
try { process.stdin.setRawMode(true); } catch (_) {}
process.stdin.on('data', (d) => { if (d.toString() === '\x03') cleanup(); });

// ─── 起動 ────────────────────────────────────────────────────────────────────
process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[2J');

setInterval(() => {
  renderFrame(t);
  t += 0.035;
}, 50);
