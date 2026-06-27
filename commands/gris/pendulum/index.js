// 二重振り子 — m1=m2=1, L1=L2=1, g=9.81
const g = 9.81, DT = 0.008, SUBSTEPS = 15;

let t1 = Math.PI * 0.75, t2 = Math.PI * 0.4;
let w1 = 0, w2 = 0;

const COLS = process.stdout.columns || 80;
const ROWS = process.stdout.rows    || 24;
const CX   = (COLS / 2) | 0;
const CY   = 4;
const ARM  = Math.min(ROWS - CY - 3, 14);

const trail = [];
const TRAIL = 100;

process.stdout.write('\x1b[?25l\x1b[?1049h\x1b[2J\x1b[H');
const restore = () => { process.stdout.write('\x1b[?25h\x1b[?1049l\x1b[0m'); process.exit(0); };
process.on('SIGINT', restore);
process.on('SIGTERM', restore);

const step = () => {
  const d = t1 - t2;
  const D = 3 - Math.cos(2 * d);
  const a1 = (-3*g*Math.sin(t1) - g*Math.sin(t1-2*t2) - 2*Math.sin(d)*(w2*w2 + w1*w1*Math.cos(d))) / D;
  const a2 = (2*Math.sin(d)*(2*w1*w1 + 2*g*Math.cos(t1) + w2*w2*Math.cos(d))) / D;
  w1 += a1 * DT;  w2 += a2 * DT;
  t1 += w1 * DT;  t2 += w2 * DT;
};

// 物理座標 → ターミナル座標（文字セルのアスペクト比を補正）
const toScreen = (px, py) => [
  Math.round(CX + px * ARM * 2.0),   // 横は2倍（文字が縦長なので）
  Math.round(CY + py * ARM * 0.5),   // 縦は0.5倍
];

const inBounds = (x, y) => x >= 1 && x <= COLS && y >= 1 && y <= ROWS;

// 2点間を補間してターミナル座標の列を返す
const line = (x1, y1, x2, y2, n = 16) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([Math.round(x1 + (x2-x1)*t), Math.round(y1 + (y2-y1)*t)]);
  }
  return pts;
};

setInterval(() => {
  for (let i = 0; i < SUBSTEPS; i++) step();

  const [b1x, b1y] = toScreen(Math.sin(t1), Math.cos(t1));
  const [b2x, b2y] = toScreen(Math.sin(t1)+Math.sin(t2), Math.cos(t1)+Math.cos(t2));

  if (inBounds(b2x, b2y)) {
    trail.push([b2x, b2y]);
    if (trail.length > TRAIL) trail.shift();
  }

  let out = '\x1b[2J';

  // トレイル（緑のグラデーション）
  trail.forEach(([x, y], i) => {
    const f = i / trail.length;
    const r = Math.round(10 + 40 * f);
    const g2 = Math.round(60 + 160 * f);
    const b = Math.round(10 + 40 * f);
    out += `\x1b[${y};${x}H\x1b[38;2;${r};${g2};${b}m·\x1b[0m`;
  });

  // 支点
  out += `\x1b[${CY};${CX}H\x1b[97m×\x1b[0m`;

  // アーム1（支点 → bob1）
  line(CX, CY, b1x, b1y).forEach(([x, y]) => {
    if (inBounds(x, y)) out += `\x1b[${y};${x}H\x1b[2;37m·\x1b[0m`;
  });

  // アーム2（bob1 → bob2）
  line(b1x, b1y, b2x, b2y).forEach(([x, y]) => {
    if (inBounds(x, y)) out += `\x1b[${y};${x}H\x1b[2;37m·\x1b[0m`;
  });

  // bob1（シアン）
  if (inBounds(b1x, b1y)) out += `\x1b[${b1y};${b1x}H\x1b[96;1m●\x1b[0m`;
  // bob2（マゼンタ）
  if (inBounds(b2x, b2y)) out += `\x1b[${b2y};${b2x}H\x1b[95;1m●\x1b[0m`;

  out += `\x1b[${ROWS};1H\x1b[2m二重振り子  Ctrl+C で終了\x1b[0m`;
  process.stdout.write(out);
}, 33);
