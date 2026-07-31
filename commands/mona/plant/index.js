#!/usr/bin/env node
'use strict';

// plant.js — 植物を眺めるターミナルタイマー
//   使い方: node plant.js  [--minutes 25]
//   ゼロ依存 (Node 標準のみ)

import readline from 'readline';

const W = 44, H = 19, CX = 21, SY = 15;
const out = (s) => process.stdout.write(s);

/* ---------- canvas ---------- */
const newCanvas = () => Array.from({ length: H }, () => Array.from({ length: W }, () => null));
function put(cv, x, y, ch, c) {
  if (ch === ' ' || y < 0 || y >= H || x < 0 || x >= W) return;
  cv[y][x] = { ch, c };
}
function text(cv, x, y, s, c) { for (let i = 0; i < s.length; i++) put(cv, x + i, y, s[i], c); }
function rows(cv, x, y, arr, c) { arr.forEach((r, i) => text(cv, x, y + i, r, c)); }
function ray(cv, x, y, dx, dy, n, ch, c) { for (let i = 0; i < n; i++) put(cv, x + dx * i, y + dy * i, ch, c); }

const POT = ['.-----------.', '|           |', ' \\_________/'];
function drawPot(cv, t) {
  text(cv, 16, SY, '~~~~~~~~~~~', t.soil);
  rows(cv, 15, SY + 1, POT, t.pot);
}

/* ---------- plants ---------- */
const leaf = (at, draw) => ({ at, draw });
const stalkChar = (dir) => (dir < 0 ? '\\' : '/');

function stem(cv, h, t, chars) {
  for (let i = 0; i < h; i++) {
    const ch = chars ? chars[i % chars.length] : '|';
    put(cv, CX, SY - 1 - i, ch, t.stem);
  }
}

const PLANTS = [];

/* ビカクシダ */
PLANTS.push({
  key: 'bikakushida', name: 'ビカクシダ',
  msg: '角のような葉が開ききりました。',
  pal: [65, 72, 108, 109], palM: [114, 121, 151, 157], stemN: 58, stemM: 101,
  trunk(cv, p, t) { text(cv, CX - 3, SY - 1, '(=====)', t.stem); },
  leaves: (() => {
    const L = [];
    const frond = (dir, base, len) => (cv, c) => {
      const sx = CX + dir * 2, sy = SY - 2 - base;
      ray(cv, sx, sy, dir, -1, len, stalkChar(dir), c);
      const ex = sx + dir * (len - 1), ey = sy - (len - 1);
      put(cv, ex - 1, ey - 1, '\\', c);
      put(cv, ex + 1, ey - 1, '/', c);
    };
    const spec = [
      [-1, 0, 3], [1, 0, 3], [-1, 1, 4], [1, 1, 4],
      [-1, 2, 5], [1, 2, 5], [-1, 3, 6], [1, 3, 6],
    ];
    spec.forEach((s, i) => L.push(leaf((i + 1) / (spec.length + 3), frond(s[0], s[1], s[2]))));
    L.push(leaf(0.80, (cv, c) => { ray(cv, CX, SY - 3, 0, -1, 6, '|', c); put(cv, CX - 1, SY - 9, '\\', c); put(cv, CX + 1, SY - 9, '/', c); }));
    L.push(leaf(0.92, (cv, c) => { ray(cv, CX - 1, SY - 4, 0, -1, 5, '|', c); put(cv, CX - 2, SY - 9, '\\', c); }));
    L.push(leaf(0.99, (cv, c) => { ray(cv, CX + 1, SY - 4, 0, -1, 5, '|', c); put(cv, CX + 2, SY - 9, '/', c); }));
    return L;
  })(),
});

/* オリーブ */
PLANTS.push({
  key: 'olive', name: 'オリーブ',
  msg: '実がふたつ、色づきました。',
  pal: [107, 143, 64, 100], palM: [156, 190, 113, 148], stemN: 101, stemM: 137,
  maxH: 12,
  trunk(cv, p, t) { stem(cv, Math.round(p * 12), t); },
  leaves: (() => {
    const L = [];
    for (let i = 0; i < 10; i++) {
      const h = 3 + i, dir = i % 2 ? 1 : -1, y = SY - h;
      L.push(leaf((h + (dir > 0 ? 0.45 : 0)) / 12.6, (cv, c) => {
        if (dir < 0) text(cv, CX - 3, y, '<~~', c); else text(cv, CX + 1, y, '~~>', c);
      }));
    }
    L.push(leaf(0.88, (cv, c) => put(cv, CX - 4, SY - 7, 'o', c)));
    L.push(leaf(0.97, (cv, c) => put(cv, CX + 4, SY - 10, 'o', c)));
    return L;
  })(),
});

/* フィカス */
PLANTS.push({
  key: 'ficus', name: 'フィカス',
  msg: '葉が厚く、艶を持ちました。',
  pal: [22, 28, 29, 35], palM: [41, 48, 84, 120], stemN: 94, stemM: 137,
  maxH: 13,
  trunk(cv, p, t) { stem(cv, Math.round(p * 13), t); },
  leaves: (() => {
    const L = [];
    const hs = [2, 4, 6, 8, 10, 12];
    hs.forEach((h, i) => {
      const dir = i % 2 ? 1 : -1, y = SY - h;
      L.push(leaf((h + 1.2) / 14, (cv, c) => {
        if (dir < 0) { text(cv, 16, y - 1, ' ___', c); text(cv, 16, y, '(___-', c); }
        else { text(cv, 23, y - 1, '___', c); text(cv, 22, y, '-___)', c); }
      }));
    });
    L.push(leaf(0.99, (cv, c) => { text(cv, CX - 1, SY - 14, '\\|/', c); }));
    return L;
  })(),
});

/* シェフレラ */
PLANTS.push({
  key: 'schefflera', name: 'シェフレラ',
  msg: '傘のような葉が揃いました。',
  pal: [65, 71, 72, 108], palM: [114, 120, 121, 157], stemN: 101, stemM: 137,
  maxH: 12,
  trunk(cv, p, t) { stem(cv, Math.round(p * 12), t); },
  leaves: (() => {
    const L = [];
    const hs = [2, 4, 6, 8, 10, 12];
    hs.forEach((h, i) => {
      const dir = i % 2 ? 1 : -1, y = SY - h;
      L.push(leaf((h + 1.4) / 13.8, (cv, c) => {
        put(cv, CX + dir, y, stalkChar(dir), c);
        rows(cv, dir < 0 ? CX - 5 : CX + 1, y - 2, ['\\\\|//', ' \\|/ '], c);
      }));
    });
    return L;
  })(),
});

/* パキラ */
PLANTS.push({
  key: 'pachira', name: 'パキラ',
  msg: '編み込みの幹に冠が乗りました。',
  pal: [34, 40, 71, 77], palM: [82, 84, 120, 157], stemN: 130, stemM: 173,
  maxH: 11,
  trunk(cv, p, t) { stem(cv, Math.round(p * 11), t, ['%', 'X']); },
  leaves: (() => {
    const L = [];
    const hs = [3, 4, 6, 7, 9, 10];
    hs.forEach((h, i) => {
      const dir = i % 2 ? 1 : -1, y = SY - h;
      L.push(leaf((h + 1.3) / 12.8, (cv, c) => {
        put(cv, CX + dir, y, stalkChar(dir), c);
        text(cv, dir < 0 ? CX - 6 : CX + 2, y - 1, '\\\\|//', c);
      }));
    });
    L.push(leaf(0.99, (cv, c) => text(cv, CX - 3, SY - 12, '\\\\\\|///', c)));
    return L;
  })(),
});

/* ---------- render ---------- */
function theme(plant, mature) {
  return {
    soil: mature ? 137 : 94,
    pot: mature ? 216 : 173,
    stem: mature ? plant.stemM : plant.stemN,
    pal: mature ? plant.palM : plant.pal,
    ink: mature ? 230 : 245,
    dim: mature ? 180 : 240,
    bg: mature ? 235 : null,
  };
}

function buildCanvas(plant, p, mature) {
  const t = theme(plant, mature);
  const cv = newCanvas();
  drawPot(cv, t);
  plant.trunk(cv, p, t);
  plant.leaves.forEach((l, i) => { if (p >= l.at) l.draw(cv, t.pal[i % t.pal.length]); });
  return cv;
}

function paint(lines, bg) {
  return lines.map((l) => {
    const body = l.length < W ? l + ' '.repeat(W - l.length) : l;
    return (bg === null ? '' : `\x1b[48;5;${bg}m`) + '  ' + body + '  \x1b[0m';
  }).join('\n');
}

function canvasLines(cv) {
  return cv.map((row) => {
    let s = '', cur = -1;
    for (const cell of row) {
      if (!cell) { if (cur !== -1) { s += '\x1b[39m'; cur = -1; } s += ' '; continue; }
      if (cell.c !== cur) { s += `\x1b[38;5;${cell.c}m`; cur = cell.c; }
      s += cell.ch;
    }
    return s + (cur === -1 ? '' : '\x1b[39m');
  });
}

const pad = (n) => String(n).padStart(2, '0');
const clock = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

function frame(plant, p, remain, mature) {
  const t = theme(plant, mature);
  const cv = buildCanvas(plant, p, mature);
  const head = mature
    ? `\x1b[38;5;${t.dim}m${plant.name}\x1b[39m` + ' '.repeat(Math.max(1, W - plant.name.length * 2 - 6)) + `\x1b[38;5;${t.dim}m成熟\x1b[39m`
    : `\x1b[38;5;${t.dim}m${plant.name}\x1b[39m` + ' '.repeat(Math.max(1, W - plant.name.length * 2 - 7)) + `\x1b[38;5;${t.ink}m残り ${clock(remain)}\x1b[39m`;
  const foot = mature
    ? `\x1b[38;5;${t.ink}m${plant.msg}\x1b[39m`
    : '';
  const hint = `\x1b[38;5;${t.dim}mq で終了\x1b[39m`;
  const lines = ['', head, '', ...canvasLines(cv), '', foot, hint, ''];
  return paint(lines, t.bg);
}

/* ---------- terminal ---------- */
const alt = (on) => out(on ? '\x1b[?1049h\x1b[?25l' : '\x1b[?25h\x1b[?1049l');
const home = () => out('\x1b[H');

function cleanup() { alt(false); try { process.stdin.setRawMode(false); } catch (e) {} }

function keys(handler) {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('keypress', (str, key) => {
    if (key && key.ctrl && key.name === 'c') { cleanup(); process.exit(0); }
    handler(str, key || {});
  });
}

function menu() {
  return new Promise((resolve) => {
    let i = 0;
    const draw = () => {
      home();
      out('\x1b[2J\x1b[H');
      const lines = ['', '\x1b[38;5;245m育てる植物を選ぶ\x1b[39m', ''];
      PLANTS.forEach((pl, n) => {
        lines.push(n === i
          ? `\x1b[38;5;${pl.pal[0]}m  \u25b8 ${pl.name}\x1b[39m`
          : `\x1b[38;5;240m    ${pl.name}\x1b[39m`);
      });
      lines.push('', '\x1b[38;5;240m\u2191\u2193 で選択 / Enter で開始 / q で終了\x1b[39m', '');
      out(paint(lines, null));
    };
    draw();
    const off = keys((str, key) => {
      if (key.name === 'up' || str === 'k') { i = (i - 1 + PLANTS.length) % PLANTS.length; draw(); }
      else if (key.name === 'down' || str === 'j') { i = (i + 1) % PLANTS.length; draw(); }
      else if (key.name === 'return' || str === ' ') { process.stdin.removeAllListeners('keypress'); resolve(PLANTS[i]); }
      else if (str === 'q') { cleanup(); process.exit(0); }
    });
    return off;
  });
}

function grow(plant, totalSec) {
  return new Promise((resolve) => {
    const start = Date.now();
    let mature = false;
    const render = () => {
      const elapsed = Math.min(totalSec, Math.floor((Date.now() - start) / 1000));
      const p = Math.min(1, elapsed / totalSec);
      if (p >= 1) mature = true;
      home();
      out(frame(plant, p, totalSec - elapsed, mature));
    };
    render();
    const id = setInterval(() => {
      render();
      if (mature) { clearInterval(id); resolve(); }
    }, 1000);
    keys((str) => { if (str === 'q') { clearInterval(id); cleanup(); process.exit(0); } });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let minutes = 25;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    let v = null;
    if (a === '--minutes' || a === '-m') v = args[i + 1];
    else if (/^--minutes=/.test(a)) v = a.slice(10);
    else if (/^(--minutes|-m)\d/.test(a)) v = a.replace(/^(--minutes|-m)/, '');
    else if (/^\d+(\.\d+)?$/.test(a)) v = a;
    if (v !== null && !isNaN(parseFloat(v))) minutes = Math.max(0.1, parseFloat(v));
  }
  alt(true);
  process.on('exit', cleanup);
  const plant = await menu();
  out('\x1b[2J');
  await grow(plant, Math.round(minutes * 60));
  keys((str) => { if (str === 'q' || str === '\r') { cleanup(); process.exit(0); } });
}

main();
