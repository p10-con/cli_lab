// 回転するドーナツ（トーラスのASCII 3Dレンダリング）
// 法線ベクトルとライティングで文字の濃さを決める古典的アルゴリズム
const CHARS = ' .,-~:;=!*#$@';

const COLS = process.stdout.columns || 80;
const ROWS = process.stdout.rows    || 24;
const CX   = COLS / 2;
const CY   = (ROWS - 1) / 2;

// トーラスのパラメータ
const R1 = 1;    // チューブの半径
const R2 = 2;    // 中心からチューブ中心までの距離
const K2 = 5;    // 視点からトーラスまでの距離
const K1 = COLS * K2 * 3 / (8 * (R1 + R2));  // 投影スケール

let A = 0, B = 0;  // 回転角（X軸, Z軸）

process.stdout.write('\x1b[?25l\x1b[2J');
const restore = () => { process.stdout.write('\x1b[?25h\x1b[2J\x1b[H\x1b[0m'); process.exit(0); };
process.on('SIGINT', restore);
process.on('SIGTERM', restore);

const frame = () => {
  const cosA = Math.cos(A), sinA = Math.sin(A);
  const cosB = Math.cos(B), sinB = Math.sin(B);

  // フレームバッファ: 輝度インデックス（-1=空）
  const buf  = new Int8Array(COLS * ROWS).fill(-1);
  const zbuf = new Float32Array(COLS * ROWS).fill(0);

  // トーラス表面を theta（チューブ断面）× phi（旋回）でサンプリング
  for (let theta = 0; theta < Math.PI * 2; theta += 0.06) {
    const cosT = Math.cos(theta), sinT = Math.sin(theta);

    for (let phi = 0; phi < Math.PI * 2; phi += 0.018) {
      const cosP = Math.cos(phi), sinP = Math.sin(phi);

      // 3D座標（2軸回転適用済み）
      const x = (R2 + R1*cosT) * (cosB*cosP + sinA*sinB*sinP) - R1*sinT*cosA*sinB;
      const y = (R2 + R1*cosT) * (sinB*cosP - sinA*cosB*sinP) + R1*sinT*cosA*cosB;
      const z = K2 + cosA*(R2 + R1*cosT)*sinP + R1*sinT*sinA;
      const ooz = 1 / z;  // z の逆数（遠いほど小さい）

      // 透視投影 → ターミナル座標
      const xp = (CX + K1 * ooz * x)        | 0;
      const yp = (CY - K1 * 0.5 * ooz * y)  | 0;  // 0.5 = 文字セルのアスペクト比補正

      // 輝度 = 法線 · 光源方向（回転後）
      const L = cosP*cosT*sinB - cosA*cosT*sinP - sinA*sinT
              + cosB*(cosA*sinT - cosT*sinA*sinP);

      if (L > 0 && xp >= 0 && xp < COLS && yp >= 0 && yp < ROWS - 1) {
        const idx = xp + yp * COLS;
        if (ooz > zbuf[idx]) {
          zbuf[idx] = ooz;
          buf[idx]  = Math.min(CHARS.length - 1, (L * CHARS.length) | 0);
        }
      }
    }
  }

  // 描画
  let out = '\x1b[H';
  for (let row = 0; row < ROWS - 1; row++) {
    for (let col = 0; col < COLS; col++) {
      const li = buf[col + row * COLS];
      if (li > 0) {
        const f = li / (CHARS.length - 1);
        // 暗部: 青紫 → 明部: 白に近い水色
        const r = Math.round(60  + 195 * f);
        const g = Math.round(80  + 175 * f);
        const b = Math.round(180 + 75  * f);
        out += `\x1b[38;2;${r};${g};${b}m${CHARS[li]}\x1b[0m`;
      } else {
        out += ' ';
      }
    }
    if (row < ROWS - 2) out += '\n';
  }
  out += `\x1b[${ROWS};1H\x1b[2m回転するドーナツ  Ctrl+C で終了\x1b[0m`;
  process.stdout.write(out);

  A += 0.06;
  B += 0.025;
};

setInterval(frame, 50);
