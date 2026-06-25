const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789abcdefABCDEF@#$%&';

const cols = process.stdout.columns || 80;
const rows = process.stdout.rows    || 24;

const drops  = Array.from({ length: cols }, () => (Math.random() * rows) | 0);
const speeds = Array.from({ length: cols }, () => ((Math.random() * 2) | 0) + 1);
const bright = Array.from({ length: cols }, () => Math.random() > 0.85);

const char = () => CHARS[(Math.random() * CHARS.length) | 0];

// カーソル非表示・画面クリア
process.stdout.write('\x1b[?25l\x1b[2J\x1b[0;0H');

// 終了時にターミナルを戻す
const cleanup = () => {
  process.stdout.write('\x1b[?25h\x1b[2J\x1b[0;0H\x1b[0m');
  process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

let tick = 0;

setInterval(() => {
  tick++;
  let out = '';

  for (let col = 0; col < cols; col++) {
    if (tick % speeds[col] !== 0) continue;

    const row = drops[col];

    // 先頭（白く光る）
    out += `\x1b[${row};${col + 1}H\x1b[97;1m${char()}\x1b[0m`;

    // 直後（明るい緑）
    if (row > 1) out += `\x1b[${row - 1};${col + 1}H\x1b[92m${char()}\x1b[0m`;

    // 中間（緑）
    if (row > 3) out += `\x1b[${row - 3};${col + 1}H\x1b[32m${char()}\x1b[0m`;

    // フェード（暗い緑）
    if (row > 6) out += `\x1b[${row - 6};${col + 1}H\x1b[2;32m${char()}\x1b[0m`;

    // 消去
    if (row > 12) out += `\x1b[${row - 12};${col + 1}H \x1b[0m`;

    drops[col] = (row >= rows + 6) ? 0 : row + 1;
  }

  process.stdout.write(out);
}, 40);
