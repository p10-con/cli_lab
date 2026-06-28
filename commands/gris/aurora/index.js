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

// ─── オーロラ輝度計算 ────────────────────────────────────────────────────────
function auroraBrightness(x, y, t) {
  const nx = x / COLS;
  const ny = y / ROWS;

  // カーテン下端（複数の sin 波を重ね合わせ）
  const base = 0.42
    + 0.14 * Math.sin(nx * 6.5  + t * 0.55)
    + 0.09 * Math.sin(nx * 11.2 + t * 0.83 + 1.3)
    + 0.06 * Math.sin(nx * 19.0 + t * 1.10 + 2.7)
    + 0.04 * Math.sin(nx * 31.0 + t * 0.40 + 0.5);

  // カーテン上端（別の波）
  const top = 0.22
    + 0.08 * Math.sin(nx * 8.3  + t * 0.45 + 4.1)
    + 0.05 * Math.sin(nx * 14.7 + t * 0.70 + 0.9);

  const d1 = Math.abs(ny - base);
  const d2 = Math.abs(ny - top);
  const bri = Math.exp(-d1 * 28) * 0.80 + Math.exp(-d2 * 22) * 0.55
            + Math.exp(-d1 * 8)  * 0.20 + Math.exp(-d2 * 6)  * 0.15;

  return Math.min(1, bri);
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

function getColorCode(x, y, cx, cy, t) {
  const dx   = x - cx;
  const dy   = (y - cy) * CHAR_ASPECT;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const radius = 22;
  const sigma  = radius * 0.42;

  // ガウシアンフォールオフで境界を自然にぼかす
  const proximity = Math.exp(-(dist * dist) / (2 * sigma * sigma));

  if (proximity < 0.005) return null; // モノクロ領域

  // 列位置 + 時刻で色相をゆっくり変化させる
  const hue = ((x / COLS * 0.6) + t * 0.04) % 1;
  const [r, g, b] = hslToRgb(hue, 1.0, 0.55);

  // 中心に向かうほど鮮やか、外側はモノクロへ滑らかに溶ける
  const blend = proximity ** 1.6;
  const fr = Math.round(r * blend + 255 * (1 - blend));
  const fg = Math.round(g * blend + 255 * (1 - blend));
  const fb = Math.round(b * blend + 255 * (1 - blend));

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
  process.stdout.write('\x1b[?1003l\x1b[?1006l'); // マウスイベント無効化
  process.stdout.write('\x1b[?25h\x1b[2J\x1b[H\x1b[0m'); // カーソル復元・画面クリア
  process.exit(0);
}
process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);

// ─── 入力処理 ──────────────────────────────────────────────────────────────
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

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
// カーソル非表示・画面クリア
process.stdout.write('\x1b[?25l\x1b[2J');

// マウスイベント有効化（any-event モード + SGR 拡張）
process.stdout.write('\x1b[?1003h\x1b[?1006h');

const INTERVAL = 50; // 20 fps
setInterval(() => {
  renderFrame(t, cx, cy);
  t += 0.035;
}, INTERVAL);
