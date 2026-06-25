// ニュートンの振り子
// 単振り子方程式を使い、角度の正負で左右どちらの玉が振れているか切り替える
const g = 9.81, L = 1;
const DT = 0.012, SUBSTEPS = 8;

const COLS = process.stdout.columns || 80;
const ROWS = process.stdout.rows    || 24;
const NUM  = 5;

// フレームと玉の配置
const pivotRow  = 3;
const ballRow   = Math.min(ROWS - 4, pivotRow + 14);
const SL        = ballRow - pivotRow;           // 糸の長さ（行数）
const SPACING   = 4;                            // 玉の間隔（列数）
const totalW    = (NUM - 1) * SPACING;
const startCol  = ((COLS - totalW) / 2) | 0;
const pivotCols = Array.from({ length: NUM }, (_, i) => startCol + i * SPACING);

// 振り子の角度（正=右に振れる, 負=左に振れる）
let theta = Math.PI / 5;  // 最初は右の玉が持ち上がっている
let omega = 0;

process.stdout.write('\x1b[?25l\x1b[2J');
const restore = () => { process.stdout.write('\x1b[?25h\x1b[2J\x1b[H\x1b[0m'); process.exit(0); };
process.on('SIGINT', restore);
process.on('SIGTERM', restore);

let prevTheta = theta;

const step = () => {
  const alpha = -(g / L) * Math.sin(theta);
  omega += alpha * DT;
  theta += omega * DT;
};

// 角度 θ から玉のターミナル座標を計算（pivot基準）
// 文字のアスペクト比補正: 横は×2
const bobPos = (pivotCol, angle) => ({
  col: pivotCol + Math.round(Math.sin(angle) * SL * 2.0),
  row: pivotRow + Math.round(Math.cos(angle) * SL),
});

// 2点間を補間（糸の描画用）
const interpolate = (c1, r1, c2, r2, n = 20) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([Math.round(c1 + (c2-c1)*t), Math.round(r1 + (r2-r1)*t)]);
  }
  return pts;
};

const inBounds = (col, row) => col >= 1 && col <= COLS && row >= 1 && row <= ROWS;

setInterval(() => {
  for (let i = 0; i < SUBSTEPS; i++) {
    prevTheta = theta;
    step();
  }

  let out = '\x1b[2J';

  // フレーム上部の横棒
  const frameL = startCol - 3;
  const frameR = startCol + totalW + 3;
  out += `\x1b[${pivotRow};${frameL}H\x1b[37m${'═'.repeat(frameR - frameL)}\x1b[0m`;

  // 各玉を描画
  for (let i = 0; i < NUM; i++) {
    const pc = pivotCols[i];
    let col, row;

    // theta > 0: 右の玉（インデックス NUM-1）が振れている
    // theta < 0: 左の玉（インデックス 0）が振れている
    if (i === NUM - 1 && theta > 0) {
      ({ col, row } = bobPos(pc, theta));
    } else if (i === 0 && theta < 0) {
      ({ col, row } = bobPos(pc, theta));
    } else {
      col = pc;
      row = ballRow;
    }

    // 糸
    interpolate(pc, pivotRow, col, row).forEach(([sc, sr]) => {
      if (inBounds(sc, sr)) out += `\x1b[${sr};${sc}H\x1b[37m│\x1b[0m`;
    });

    // 玉（揺れている玉は明るく）
    const isActive = (i === NUM-1 && theta > 0) || (i === 0 && theta < 0);
    const ballChar = isActive ? '\x1b[97;1m◉\x1b[0m' : '\x1b[37m●\x1b[0m';
    if (inBounds(col, row)) out += `\x1b[${row};${col}H${ballChar}`;
  }

  out += `\x1b[${ROWS};1H\x1b[2mニュートンの振り子  Ctrl+C で終了\x1b[0m`;
  process.stdout.write(out);
}, 33);
