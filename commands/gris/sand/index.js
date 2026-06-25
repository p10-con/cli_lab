const COLS = process.stdout.columns || 80;
const ROWS = process.stdout.rows    || 24;
const W = COLS, H = ROWS - 1;

// 0=空, 1=砂
const grid = Array.from({ length: H }, () => new Uint8Array(W));

// 砂の色パレット（位置でランダムに選ぶ）
const COLORS = [
  [210, 180, 140],
  [222, 195, 155],
  [194, 158, 120],
  [230, 205, 165],
  [180, 148, 110],
];

process.stdout.write('\x1b[?25l\x1b[2J');
const restore = () => { process.stdout.write('\x1b[?25h\x1b[2J\x1b[H\x1b[0m'); process.exit(0); };
process.on('SIGINT', restore);
process.on('SIGTERM', restore);

let dropX = (W / 2) | 0;
let driftDir = 1;
let tick = 0;

const update = () => {
  // 下から上に走査（下から積もる）
  for (let row = H - 2; row >= 0; row--) {
    for (let col = 0; col < W; col++) {
      if (!grid[row][col]) continue;

      // 真下が空なら落下
      if (!grid[row + 1][col]) {
        grid[row + 1][col] = 1;
        grid[row][col] = 0;
        continue;
      }

      // 斜め下に落ちる
      const goLeft  = col - 1 >= 0    && !grid[row + 1][col - 1];
      const goRight = col + 1 < W     && !grid[row + 1][col + 1];
      if (goLeft && goRight) {
        const d = Math.random() < 0.5 ? -1 : 1;
        grid[row + 1][col + d] = 1;
        grid[row][col] = 0;
      } else if (goLeft) {
        grid[row + 1][col - 1] = 1;
        grid[row][col] = 0;
      } else if (goRight) {
        grid[row + 1][col + 1] = 1;
        grid[row][col] = 0;
      }
    }
  }

  // 砂を上から降らせる（少しランダムに揺れながら）
  tick++;
  if (tick % 2 === 0) {
    if (Math.random() < 0.05) driftDir *= -1;
    dropX = Math.max(2, Math.min(W - 3, dropX + driftDir));
  }
  const cx = dropX + ((Math.random() * 5 - 2) | 0);
  if (cx >= 0 && cx < W) grid[0][cx] = 1;
};

const render = () => {
  let out = '\x1b[H';
  for (let row = 0; row < H; row++) {
    let line = '';
    for (let col = 0; col < W; col++) {
      if (grid[row][col]) {
        const [r, g, b] = COLORS[(row * 7 + col * 3) % COLORS.length];
        line += `\x1b[38;2;${r};${g};${b}m█\x1b[0m`;
      } else {
        line += ' ';
      }
    }
    out += line + (row < H - 1 ? '\n' : '');
  }
  out += `\x1b[${ROWS};1H\x1b[2m落下する砂  Ctrl+C で終了\x1b[0m`;
  process.stdout.write(out);
};

setInterval(() => { update(); render(); }, 40);
