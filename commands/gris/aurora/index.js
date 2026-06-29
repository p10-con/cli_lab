/**
 * aurora — ターミナルのオーロラアニメーション
 * 通常時はモノクロ ASCII、カーソル周辺だけオーロラカラーが灯る
 *
 * Node.js 18+ 標準ライブラリのみ使用
 */

// ─── ターミナルサイズ ────────────────────────────────────────────────────────
const COLS = process.stdout.columns || 80;
const ROWS = process.stdout.rows    || 24;

// ─── ASCII グリフ（暗→明）────────────────────────────────────────────────────
const CHARS = [' ', '.', '·', ':', '╎', '│', '┃', '║', '█'];

function brightnessToChar(b) {
  return CHARS[Math.min(CHARS.length - 1, Math.floor(b * CHARS.length))];
}

// ─── オーロラ輝度計算 ─────────────────────────────────────────────────────────

// 1D スムーズノイズ（カーテン縦レイ構造用）
function smoothNoise1D(p) {
  const i  = Math.floor(p);
  const f  = p - i;
  const u  = f * f * (3 - 2 * f); // smoothstep
  const s0 = Math.sin(i       * 127.1 + 311.7) * 43758.5453;
  const s1 = Math.sin((i + 1) * 127.1 + 311.7) * 43758.5453;
  return (s0 - Math.floor(s0)) * (1 - u) + (s1 - Math.floor(s1)) * u;
}

// オーロラ帯の中心 Y（緩やかに揺れる）
function auroraCenter(nx, t) {
  return 0.48
    + 0.10 * Math.sin(nx * 3.8  + t * 0.22)
    + 0.07 * Math.sin(nx * 8.1  + t * 0.38 + 1.3)
    + 0.04 * Math.sin(nx * 14.7 + t * 0.55 + 2.7)
    + 0.02 * Math.sin(nx * 26.3 + t * 0.30 + 0.5);
}

// オーロラ帯の半幅（カーテンの厚さ、場所・時刻で変化）
function auroraHalfWidth(nx, t) {
  return 0.14
    + 0.04 * Math.sin(nx * 5.5 + t * 0.14 + 3.0)
    + 0.02 * Math.sin(nx * 9.3 + t * 0.23 + 1.8);
}

// 縦レイ（カーテン）強度: ノイズ複数オクターブで自然な縞を作る
function rayIntensity(nx, t) {
  const n1 = smoothNoise1D(nx * 40 + t * 0.10);
  const n2 = smoothNoise1D(nx * 18 + t * 0.15 + 5.3);
  const n3 = smoothNoise1D(nx *  8 + t * 0.06 + 2.1);
  const n4 = smoothNoise1D(nx *  3 + t * 0.04 + 8.7);
  return n1 * 0.44 + n2 * 0.28 + n3 * 0.18 + n4 * 0.10;
}

// 3層のオーロラカーテン（視差で奥行きを演出）
// ts=時間スケール, yo=Y中心オフセット, ws=帯幅スケール, maxBri=最大輝度, phase=位相
const AURORA_LAYERS = [
  { ts: 0.55, yo: -0.08, ws: 0.75, maxBri: 0.40, phase: 0.0 }, // 遠景: 遅く・高く・暗い
  { ts: 1.00, yo:  0.00, ws: 1.00, maxBri: 0.72, phase: 2.3 }, // 中景
  { ts: 1.55, yo:  0.10, ws: 1.20, maxBri: 1.00, phase: 5.1 }, // 近景: 速く・低く・明るい
];

// 帯からの距離 → エンベロープ輝度（上は緩やか、下は急速にフェード）
function layerEnv(normDy) {
  const above = Math.max(0, -normDy);
  const below = Math.max(0,  normDy);
  return Math.exp(-(above ** 2) * 1.8) * Math.exp(-(below ** 2) * 4.0);
}

function auroraBrightness(x, y, t) {
  const nx = x / COLS;
  const ny = y / ROWS;

  let total = 0;
  for (const layer of AURORA_LAYERS) {
    const lt     = t * layer.ts + layer.phase; // 層ごとに独立した時間
    const center = auroraCenter(nx, lt) + layer.yo;
    const halfW  = auroraHalfWidth(nx, lt) * layer.ws;
    const normDy = (ny - center) / halfW;

    const env   = layerEnv(normDy);
    const rays  = rayIntensity(nx, lt);
    const pulse = 0.80 + 0.20 * Math.sin(lt * 1.1 + nx * 5.3);

    total += env * (0.35 + rays * 0.65) * pulse * layer.maxBri;
  }

  return Math.min(1, total);
}

// ─── HSL → RGB (0〜255) ──────────────────────────────────────────────────────
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
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

// ─── カーソル周辺の aurora カラーコード ──────────────────────────────────────
// 文字セルは高さ:幅 ≈ 2:1 なので Y 方向を 2 倍に補正して円形にする
const CHAR_ASPECT = 2;

// 帯内の高度位置でオーロラらしい色相を決定
// normDy < 0 (帯より上 = 高高度): 赤
// normDy ≈ 0 (帯中心):            緑
// normDy > 0 (帯より下):          青紫
function auroraHue(normDy) {
  if (normDy < 0) {
    const k = Math.min(1, -normDy * 1.1);
    return 0.33 - k * 0.33; // 緑(0.33) → 赤(0.00)
  } else {
    const k = Math.min(1, normDy * 1.1);
    return 0.33 + k * 0.40; // 緑(0.33) → 青紫(0.73)
  }
}

function getColorCode(x, y, cx, cy, t) {
  const dx   = x - cx;
  const dy   = (y - cy) * CHAR_ASPECT;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const radius = 22;
  const sigma  = radius * 0.42;
  const proximity = Math.exp(-(dist * dist) / (2 * sigma * sigma));
  if (proximity < 0.005) return null;

  // 各層の寄与を輝度で加重平均した normDy で色相を決定
  const nx = x / COLS;
  const ny = y / ROWS;
  let wSum = 0, ndSum = 0;
  for (const layer of AURORA_LAYERS) {
    const lt     = t * layer.ts + layer.phase;
    const center = auroraCenter(nx, lt) + layer.yo;
    const halfW  = auroraHalfWidth(nx, lt) * layer.ws;
    const nd     = (ny - center) / halfW;
    const w      = layerEnv(nd) * layer.maxBri;
    wSum  += w;
    ndSum += nd * w;
  }
  const normDy = wSum > 0.001 ? ndSum / wSum : 0;

  const hue = auroraHue(normDy);
  const lum = 0.50 + Math.max(0, -normDy) * 0.07; // 上端(赤)はやや明るい
  const [r, g, b] = hslToRgb(hue, 1.0, lum);

  // 中心に向かうほど鮮やか、外側はモノクロへ滑らかに溶ける
  const blend = proximity ** 1.6;
  const bri   = auroraBrightness(x, y, t);
  const mv    = Math.round(40 + bri * 200); // モノクロ輝度
  const fr = Math.round(r * blend + mv * (1 - blend));
  const fg = Math.round(g * blend + mv * (1 - blend));
  const fb = Math.round(b * blend + mv * (1 - blend));

  return `\x1b[38;2;${fr};${fg};${fb}m`;
}

// ─── モノクロ輝度 → グレー色コード ──────────────────────────────────────────
function monoColor(brightness) {
  const v = Math.round(40 + brightness * 200);
  return `\x1b[38;2;${v};${v};${v}m`;
}

// ─── フレームレンダリング ─────────────────────────────────────────────────────
function renderFrame(t, cx, cy) {
  let out = '\x1b[H'; // カーソルをホームへ
  for (let row = 0; row < ROWS - 1; row++) {
    for (let col = 0; col < COLS; col++) {
      const bri   = auroraBrightness(col, row, t);
      const ch    = brightnessToChar(bri);
      const vivid = getColorCode(col, row, cx, cy, t);

      if (vivid) {
        out += vivid + ch + '\x1b[0m';
      } else {
        out += monoColor(bri) + ch + '\x1b[0m';
      }
    }
    if (row < ROWS - 2) out += '\n';
  }
  // 最下行: ヒント（薄く表示）
  out += `\x1b[${ROWS};1H\x1b[2m矢印キー / マウスでポインタを動かすと色が灯る  Ctrl+C で終了\x1b[0m`;
  process.stdout.write(out);
}

// ─── 状態 ────────────────────────────────────────────────────────────────────
let t  = 0;
let cx = Math.floor(COLS / 2);
let cy = Math.floor(ROWS / 2);

// ─── クリーンアップ ──────────────────────────────────────────────────────────
function cleanup() {
  process.stdout.write('\x1b[?1003l\x1b[?1002l\x1b[?1000l\x1b[?1006l'); // マウスイベント無効化
  process.stdout.write('\x1b[?25h\x1b[2J\x1b[H\x1b[0m'); // カーソル復元・画面クリア
  process.stdout.write('\x1b[?1049l'); // 代替スクリーンバッファを終了
  process.exit(0);
}
process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);

// ─── 入力処理 ──────────────────────────────────────────────────────────────
// resume() でフローイングモードに（data イベントを確実に受信するため）
process.stdin.resume();
// shell=True 経由だと isTTY が false になる場合があるので try/catch で必ず試みる
// raw モードなしだとマウスイベントが行バッファリングされて届かない
try { process.stdin.setRawMode(true); } catch (_) {}

process.stdin.on('data', (data) => {
  const s = data.toString();

  // Ctrl+C
  if (s === '\x03') {
    cleanup();
    return;
  }

  // SGR マウスイベント: \x1b[<btn;x;yM (press/move) または \x1b[<btn;x;ym (release)
  const mouseMatch = s.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
  if (mouseMatch) {
    cx = Math.max(0, Math.min(COLS - 1, parseInt(mouseMatch[2], 10) - 1));
    cy = Math.max(0, Math.min(ROWS - 2, parseInt(mouseMatch[3], 10) - 1));
    return;
  }

  // 矢印キー（ESC [ A/B/C/D）
  if (s === '\x1b[A') { cy = Math.max(0,        cy - 1); return; } // Up
  if (s === '\x1b[B') { cy = Math.min(ROWS - 2, cy + 1); return; } // Down
  if (s === '\x1b[C') { cx = Math.min(COLS - 1, cx + 1); return; } // Right
  if (s === '\x1b[D') { cx = Math.max(0,        cx - 1); return; } // Left
});

// ─── 起動 ────────────────────────────────────────────────────────────────────
// 代替スクリーンバッファ→カーソル非表示→画面クリア
process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[2J');

// マウスイベント有効化（互換性のため全モード有効化 + SGR 拡張座標）
// ?1000h: クリック, ?1002h: ドラッグ, ?1003h: 移動含む全イベント, ?1006h: SGR座標
process.stdout.write('\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h');

const INTERVAL = 50; // 20 fps
setInterval(() => {
  renderFrame(t, cx, cy);
  t += 0.035;
}, INTERVAL);
