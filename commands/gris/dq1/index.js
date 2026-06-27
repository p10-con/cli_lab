#!/usr/bin/env node
/**
 * dq1 — ドラクエ1風テキストRPG
 * 魔王ゾーマを倒して世界を救え！
 *
 * Node.js 18+ 標準ライブラリのみ使用
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVE_FILE = path.join(__dirname, 'save.json');

// ─── ANSI カラー ────────────────────────────────────────────────────────────
const C = {
  reset:      '\x1b[0m',
  bold:       '\x1b[1m',
  dim:        '\x1b[2m',
  yellow:     '\x1b[33m',
  boldYellow: '\x1b[1;33m',
  white:      '\x1b[37m',
  boldWhite:  '\x1b[1;37m',
  red:        '\x1b[31m',
  boldRed:    '\x1b[1;31m',
  green:      '\x1b[32m',
  boldGreen:  '\x1b[1;32m',
  blue:       '\x1b[34m',
  boldBlue:   '\x1b[1;34m',
  cyan:       '\x1b[36m',
  boldCyan:   '\x1b[1;36m',
  magenta:    '\x1b[35m',
};

// ─── ユーティリティ ─────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typewrite(text, delay = 22) {
  for (const ch of text) {
    process.stdout.write(ch);
    await sleep(delay);
  }
  process.stdout.write('\n');
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** 固定幅の枠を返す（日本語・絵文字対応のため固定幅にする） */
function box(lines, color = C.boldYellow, width = 36) {
  const bar = '━'.repeat(width);
  const rows = [`${color}┏${bar}┓${C.reset}`];
  for (const line of lines) {
    rows.push(`${color}┃${C.reset}  ${line}`);
  }
  rows.push(`${color}┗${bar}┛${C.reset}`);
  return rows.join('\n');
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(val, lo, hi) {
  return Math.min(Math.max(val, lo), hi);
}

function hpBar(hp, maxHp, width = 12) {
  const filled = Math.round((hp / maxHp) * width);
  const ratio  = hp / maxHp;
  const color  = ratio > 0.5 ? C.green : ratio > 0.25 ? C.yellow : C.boldRed;
  return color + '█'.repeat(filled) + C.dim + '░'.repeat(width - filled) + C.reset;
}

function mpBar(mp, maxMp, width = 8) {
  const filled = Math.round((mp / maxMp) * width);
  return C.boldBlue + '█'.repeat(filled) + C.dim + '░'.repeat(width - filled) + C.reset;
}

function hpStr(hp, maxHp) {
  const ratio = hp / maxHp;
  const color = ratio > 0.5 ? C.green : ratio > 0.25 ? C.yellow : C.boldRed;
  return `${color}${hp}${C.reset}/${C.white}${maxHp}${C.reset}`;
}

// ─── readline ──────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('close', () => process.exit(0));
process.on('SIGINT', () => rl.close());

/** コマンド入力（小文字化） */
function ask(prompt) {
  return new Promise((resolve) => {
    rl.question(C.yellow + prompt + C.reset, (ans) => resolve(ans.trim().toLowerCase()));
  });
}

/** 名前など大文字小文字を保持する入力 */
function askRaw(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (ans) => resolve(ans.trim()));
  });
}

// ─── エリア定義 ────────────────────────────────────────────────────────────
const AREAS = {
  town: {
    id: 'town',
    name: '城下町アレフガルド',
    desc: '石畳の城下町。王の城がそびえ立ち、商人や兵士が行き交っている。',
    color: C.boldCyan,
    encounter: false,
    exits: { n: 'grassland' },
  },
  grassland: {
    id: 'grassland',
    name: '大草原',
    desc: '風がそよぐ広大な草原。緑の波が山際まで続いている。敵が潜んでいるかもしれない…',
    color: C.green,
    encounter: true,
    encounterRate: 0.40,
    exits: { n: 'cave', s: 'town' },
    enemies: ['slime', 'dracky'],
  },
  cave: {
    id: 'cave',
    name: 'おそろしい洞窟',
    desc: 'じめじめした暗い洞窟。松明の炎がゆらめき、奥から唸り声が聞こえる…',
    color: C.white,
    encounter: true,
    encounterRate: 0.50,
    exits: { n: 'demoncastle', s: 'grassland' },
    enemies: ['chimera', 'golem'],
  },
  demoncastle: {
    id: 'demoncastle',
    name: '魔王城',
    desc: '漆黒の城。空気が重く、ゾーマの闇の力が肌に刺さる…',
    color: C.boldRed,
    encounter: false,
    exits: { s: 'cave' },
  },
};

const MAP_ART = [
  '',
  C.boldRed   + '   ╔══════════╗',
  C.boldRed   + '   ║  魔王城  ║' + C.reset,
  '        │',
  C.white     + '   ╔══════════╗',
  C.white     + '   ║  洞  窟  ║' + C.reset,
  '        │',
  C.green     + '   ╔══════════╗',
  C.green     + '   ║  大草原  ║' + C.reset,
  '        │',
  C.boldCyan  + '   ╔══════════╗',
  C.boldCyan  + '   ║ 城 下 町 ║' + C.reset,
  '',
].join('\n');

// ─── 敵定義 ──────────────────────────────────────────────────────────────
const ENEMY_DEFS = {
  slime: {
    name: 'スライム',
    maxHp: 12, atk: 6, def: 2,
    exp: 5, gold: 4,
    color: C.green,
    art: " (´・ω・`)\n  スライム",
  },
  dracky: {
    name: 'ドラキー',
    maxHp: 22, atk: 11, def: 5,
    exp: 12, gold: 7,
    color: C.magenta,
    art: "  (>O<)\n ドラキー",
  },
  chimera: {
    name: 'キメラ',
    maxHp: 42, atk: 22, def: 10,
    exp: 22, gold: 15,
    color: C.yellow,
    art: " {(ΦωΦ)}\n  キメラ",
  },
  golem: {
    name: 'ゴーレム',
    maxHp: 65, atk: 30, def: 16,
    exp: 40, gold: 24,
    color: C.boldWhite,
    art: "  [■ ■]\n ゴーレム",
  },
  zoma: {
    name: 'ゾーマ',
    maxHp: 200, atk: 44, def: 28,
    exp: 0, gold: 0,
    color: C.boldRed,
    art: " Ψ(´∀`)Ψ\n  ZOMA",
    isBoss: true,
  },
};

function spawnEnemy(key) {
  const d = ENEMY_DEFS[key];
  return { ...d, hp: d.maxHp };
}

// ─── レベルテーブル ──────────────────────────────────────────────────────
// [expNeeded, hpUp, atkUp, defUp, mpUp]
const LEVEL_TABLE = [
  null,                   // index 0 unused
  [0,    15, 10, 5,  8], // Lv1 initial stats
  [20,   5,  3,  1,  2],
  [50,   5,  3,  1,  2],
  [100,  6,  4,  1,  2],
  [170,  6,  4,  2,  3],
  [260,  7,  4,  2,  3],
  [380,  7,  5,  2,  3],
  [540,  8,  5,  2,  4],
  [750,  8,  5,  3,  4],
  [1000, 9,  6,  3,  4],
];

function nextExpNeeded(level) {
  if (level >= LEVEL_TABLE.length - 1) return Infinity;
  return LEVEL_TABLE[level + 1][0];
}

// ─── プレイヤー作成 ─────────────────────────────────────────────────────────
function createPlayer(name) {
  const [, hp, atk, def, mp] = LEVEL_TABLE[1];
  return {
    name,
    level: 1,
    hp, maxHp: hp,
    mp, maxMp: mp,
    atk, def,
    exp: 0,
    gold: 60,
    items: { herb: 3 },
    location: 'town',
  };
}

async function checkLevelUp(player) {
  while (player.level < LEVEL_TABLE.length - 1) {
    const needed = LEVEL_TABLE[player.level + 1][0];
    if (player.exp < needed) break;

    player.level++;
    const [, hpUp, atkUp, defUp, mpUp] = LEVEL_TABLE[player.level];
    player.maxHp += hpUp;
    player.hp     = clamp(player.hp + hpUp, 0, player.maxHp);
    player.atk   += atkUp;
    player.def   += defUp;
    player.maxMp += mpUp;
    player.mp     = clamp(player.mp + mpUp, 0, player.maxMp);

    console.log('\n' + box([
      `${C.boldYellow}★ レベルアップ！ Lv.${player.level} ★`,
      `${C.white}HP +${hpUp}  ATK +${atkUp}  DEF +${defUp}  MP +${mpUp}`,
      `${C.dim}次のLvまで: ${nextExpNeeded(player.level) === Infinity ? 'MAX' : nextExpNeeded(player.level) - player.exp}`,
    ], C.boldYellow));
    await sleep(700);
  }
}

// ─── セーブ / ロード ─────────────────────────────────────────────────────
function saveGame(player) {
  fs.writeFileSync(SAVE_FILE, JSON.stringify(player, null, 2), 'utf-8');
  console.log(C.boldCyan + '✦ ゲームをセーブしました。' + C.reset);
}

function loadGame() {
  if (!fs.existsSync(SAVE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(SAVE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

// ─── ステータス表示 ─────────────────────────────────────────────────────
function showStatusLine(player) {
  console.log(
    `${C.boldYellow}┌─${C.boldWhite} ${player.name} ${C.yellow}Lv.${player.level}` +
    `  HP[${hpBar(player.hp, player.maxHp, 10)}${C.boldYellow}]` +
    `  MP[${mpBar(player.mp, player.maxMp, 7)}${C.boldYellow}]` +
    `  ${C.yellow}G:${player.gold}  EXP:${player.exp}` +
    ` ${C.boldYellow}─┐${C.reset}`
  );
}

function showStatusDetail(player) {
  const toNext = nextExpNeeded(player.level) === Infinity
    ? '(MAX LEVEL)'
    : `あと ${nextExpNeeded(player.level) - player.exp}`;
  console.log('\n' + box([
    `${C.boldYellow}★ ${player.name} のステータス ★`,
    `${C.yellow}Lv: ${C.white}${player.level}${C.reset}`,
    `${C.green}HP:  ${player.hp} / ${player.maxHp}`,
    `${C.boldBlue}MP:  ${player.mp} / ${player.maxMp}`,
    `${C.yellow}攻撃力: ${player.atk}   防御力: ${player.def}`,
    `${C.white}EXP: ${player.exp}   次Lv: ${toNext}`,
    `${C.yellow}Gold: ${player.gold}G   やくそう: ${player.items.herb || 0}個`,
  ], C.boldYellow));
}

// ─── 戦闘システム ────────────────────────────────────────────────────────
async function battle(player, enemyKey) {
  const enemy = spawnEnemy(enemyKey);

  // 戦闘開始演出
  console.log('\n');
  if (enemy.art) {
    const artLines = enemy.art.split('\n');
    for (const line of artLines) {
      console.log(`  ${enemy.color}${line}${C.reset}`);
    }
  }
  console.log(box(
    [`${C.boldRed}⚔  ${enemy.name}があらわれた！`],
    C.boldRed
  ));
  await sleep(500);

  // 戦闘ループ
  while (true) {
    // 戦闘UI
    console.log(`\n${C.boldYellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    console.log(
      `  ${C.boldWhite}${player.name}${C.reset}` +
      `  HP: ${hpStr(player.hp, player.maxHp)}` +
      `  MP: ${C.boldBlue}${player.mp}${C.reset}/${player.maxMp}`
    );
    console.log(
      `  ${enemy.color}${enemy.name}${C.reset}` +
      `  HP: ${hpStr(enemy.hp, enemy.maxHp)}`
    );
    console.log(`${C.boldYellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    console.log(
      `  ${C.yellow}[1]${C.reset}たたかう` +
      `  ${C.yellow}[2]${C.reset}じゅもん` +
      `  ${C.yellow}[3]${C.reset}どうぐ` +
      `  ${C.yellow}[4]${C.reset}にげる`
    );

    const cmd = await ask('せんとう> ');
    console.log('');

    let playerActed = true;

    if (cmd === '1') {
      // ─ たたかう
      const dmg = Math.max(1, player.atk - rand(0, Math.floor(enemy.def / 2)));
      enemy.hp -= dmg;
      await typewrite(
        `${C.boldWhite}${player.name}${C.reset}の攻撃！` +
        ` ${enemy.color}${enemy.name}${C.reset}に` +
        ` ${C.boldYellow}${dmg}${C.reset}のダメージ！`
      );

    } else if (cmd === '2') {
      // ─ じゅもん
      console.log(
        `  ${C.cyan}[1]${C.reset}ホイミ（MP3: HP回復）` +
        `  ${C.cyan}[2]${C.reset}ギラ（MP5: 炎攻撃）` +
        `  ${C.cyan}[0]${C.reset}キャンセル`
      );
      const sp = await ask('じゅもん> ');
      console.log('');
      if (sp === '1') {
        if (player.mp < 3) {
          await typewrite(`${C.boldRed}MPが足りない！${C.reset}`);
          playerActed = false;
        } else {
          player.mp -= 3;
          const heal = rand(28, 38);
          const before = player.hp;
          player.hp = clamp(player.hp + heal, 0, player.maxHp);
          await typewrite(
            `${C.boldCyan}ホイミ！${C.reset} HPが ${C.green}${player.hp - before}${C.reset} 回復した！`
          );
        }
      } else if (sp === '2') {
        if (player.mp < 5) {
          await typewrite(`${C.boldRed}MPが足りない！${C.reset}`);
          playerActed = false;
        } else {
          player.mp -= 5;
          const dmg = rand(22, 32);
          enemy.hp -= dmg;
          await typewrite(
            `${C.boldRed}ギラ！${C.reset} 炎が燃えあがる！` +
            ` ${enemy.color}${enemy.name}${C.reset}に ${C.boldYellow}${dmg}${C.reset}のダメージ！`
          );
        }
      } else {
        await typewrite(`${C.dim}キャンセルした。${C.reset}`);
        playerActed = false;
      }

    } else if (cmd === '3') {
      // ─ どうぐ
      const count = player.items.herb || 0;
      if (count <= 0) {
        await typewrite(`${C.boldRed}やくそうが ない！${C.reset}`);
        playerActed = false;
      } else {
        player.items.herb = count - 1;
        const heal = rand(35, 45);
        const before = player.hp;
        player.hp = clamp(player.hp + heal, 0, player.maxHp);
        await typewrite(
          `やくそうを つかった！ HPが ${C.green}${player.hp - before}${C.reset} 回復した！`
        );
      }

    } else if (cmd === '4') {
      // ─ にげる
      if (rand(1, 4) !== 1) {
        await typewrite(`${C.yellow}うまく にげられた！${C.reset}`);
        return 'fled';
      } else {
        await typewrite(`${C.boldRed}にげられない！${C.reset}`);
      }

    } else {
      playerActed = false;
    }

    // 勝利チェック
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      await typewrite(`${enemy.color}${enemy.name}${C.reset}を ${C.boldYellow}たおした！${C.reset}`);
      await sleep(200);
      if (!enemy.isBoss) {
        await typewrite(
          `${C.yellow}${enemy.exp}けいけんちと ${enemy.gold}ゴールドを てにいれた！${C.reset}`
        );
        player.exp  += enemy.exp;
        player.gold += enemy.gold;
        await checkLevelUp(player);
      }
      return 'win';
    }

    // 敵ターン（プレイヤーが行動した場合のみ）
    if (!playerActed) continue;

    await sleep(350);
    const eDmg = Math.max(1, enemy.atk - rand(0, Math.floor(player.def / 2)));
    player.hp -= eDmg;
    await typewrite(
      `${enemy.color}${enemy.name}${C.reset}の攻撃！` +
      ` ${C.boldWhite}${player.name}${C.reset}に` +
      ` ${C.boldRed}${eDmg}${C.reset}のダメージ！`
    );

    if (player.hp <= 0) {
      player.hp = 0;
      await sleep(300);
      await typewrite(`${C.boldRed}${player.name}は たおれてしまった…${C.reset}`);
      return 'dead';
    }
  }
}

// ─── ショップ ─────────────────────────────────────────────────────────────
async function shop(player) {
  console.log(`\n${C.boldCyan}道具屋：${C.reset}いらっしゃい！何を買いますか？`);
  console.log(`  ${C.yellow}[1]${C.reset} やくそう      ${C.yellow}30G${C.reset}  （HP回復）`);
  console.log(`  ${C.yellow}[0]${C.reset} でる`);
  console.log(`  ${C.dim}所持金: ${player.gold}G   やくそう: ${player.items.herb || 0}個${C.reset}`);

  while (true) {
    const cmd = await ask('みせ> ');
    if (cmd === '1') {
      if (player.gold < 30) {
        await typewrite(`${C.boldRed}ゴールドが足りません！${C.reset}`);
      } else {
        player.gold -= 30;
        player.items.herb = (player.items.herb || 0) + 1;
        await typewrite(
          `${C.green}やくそうを 1つ 買いました！` +
          ` (計 ${player.items.herb}個)${C.reset}`
        );
      }
    } else {
      break;
    }
  }
}

// ─── 宿屋 ───────────────────────────────────────────────────────────────
async function inn(player) {
  const cost = Math.max(10, player.level * 8);
  console.log(`\n${C.boldCyan}宿屋のおかみ：${C.reset}一泊 ${C.yellow}${cost}G${C.reset} じゃよ。`);
  console.log(`  ${C.yellow}[1]${C.reset} とまる（HP・MP全回復）`);
  console.log(`  ${C.yellow}[0]${C.reset} でる`);
  console.log(`  ${C.dim}所持金: ${player.gold}G${C.reset}`);

  const cmd = await ask('やど> ');
  if (cmd === '1') {
    if (player.gold < cost) {
      await typewrite(`${C.boldRed}ゴールドが足りません！${C.reset}`);
    } else {
      player.gold -= cost;
      player.hp   = player.maxHp;
      player.mp   = player.maxMp;
      console.log(`\n${C.dim}  ...zzz... zzz...${C.reset}`);
      await sleep(1800);
      await typewrite(`${C.boldGreen}ぐっすり眠った。HPとMPが全回復した！${C.reset}`);
    }
  }
}

// ─── ゲームオーバー ──────────────────────────────────────────────────────
async function gameOver(player) {
  console.log('\n\n' + box([
    `${C.boldRed}  G A M E   O V E R  `,
    `${C.white}${player.name}は たおれてしまった…`,
    `${C.dim}セーブデータがあれば 続けられます`,
  ], C.boldRed));

  await sleep(900);
  console.log(
    `\n  ${C.yellow}[r]${C.reset}セーブから再開  ` +
    `${C.yellow}[n]${C.reset}最初から  ` +
    `${C.yellow}[q]${C.reset}おわる`
  );
  const cmd = await ask('> ');

  if (cmd === 'r') {
    const saved = loadGame();
    if (saved) {
      await typewrite(`${C.cyan}セーブデータからやり直します…${C.reset}`);
      await sleep(500);
      await gameLoop(saved);
    } else {
      await typewrite(`${C.red}セーブデータが見つかりません。${C.reset}`);
      await newGame();
    }
  } else if (cmd === 'n') {
    await newGame();
  } else {
    rl.close();
  }
}

// ─── エンディング ──────────────────────────────────────────────────────────
async function ending(player) {
  console.clear();
  await sleep(600);
  console.log('\n\n');
  console.log(C.boldYellow + [
    '  ╔══════════════════════════════════╗',
    '  ║                                  ║',
    '  ║   ★ ★ CONGRATULATIONS ★ ★      ║',
    '  ║                                  ║',
    '  ╚══════════════════════════════════╝',
  ].join('\n') + C.reset);
  await sleep(1000);
  console.log('');
  await typewrite(`  ${C.boldYellow}${player.name}${C.reset}は ゾーマを たおした！`, 35);
  await sleep(400);
  await typewrite(`  世界を おおっていた 闇が はれていく…`, 30);
  await sleep(400);
  await typewrite(`  人々が 光の中で 目を 覚ます。`, 30);
  await sleep(600);
  await typewrite(`  「${player.name}よ！よくぞ戻った！`, 25);
  await typewrite(`   あなたこそ 真の 勇者だ！」`, 25);
  await sleep(700);
  console.log('\n' + box([
    `${C.boldYellow}T H E   E N D`,
    `${C.white}Lv.${player.level}  EXP: ${player.exp}  Gold: ${player.gold}G`,
    `${C.dim}ありがとうございました！`,
  ], C.boldYellow));
  console.log('');
  rl.close();
}

// ─── メインゲームループ ────────────────────────────────────────────────────
async function gameLoop(player) {
  let bossGreeted = false;

  while (true) {
    const area = AREAS[player.location];
    console.log('\n');
    showStatusLine(player);
    console.log(`\n${area.color}【 ${area.name} 】${C.reset}`);
    await typewrite(area.desc, 12);
    console.log('');

    // ─── 城下町 ─────────────────────────────────────────────────────────
    if (player.location === 'town') {
      console.log(
        `  ${C.yellow}[n]${C.reset}きた（草原へ）` +
        `  ${C.yellow}[s]${C.reset}みせ` +
        `  ${C.yellow}[i]${C.reset}やど` +
        `  ${C.yellow}[st]${C.reset}ステータス` +
        `  ${C.yellow}[save]${C.reset}セーブ` +
        `  ${C.yellow}[map]${C.reset}マップ` +
        `  ${C.yellow}[q]${C.reset}おわる`
      );
      const cmd = await ask('> ');
      if      (cmd === 'n')    { player.location = 'grassland'; }
      else if (cmd === 's')    { await shop(player); }
      else if (cmd === 'i')    { await inn(player); }
      else if (cmd === 'st')   { showStatusDetail(player); }
      else if (cmd === 'save') { saveGame(player); }
      else if (cmd === 'load') { await tryLoad(player); }
      else if (cmd === 'map')  { console.log(MAP_ART); }
      else if (cmd === 'q')    { console.log(C.dim + 'またね！' + C.reset); rl.close(); return; }
      continue;
    }

    // ─── 魔王城 ─────────────────────────────────────────────────────────
    if (player.location === 'demoncastle') {
      console.log(`${C.boldRed}  ゾーマの闘気が漂っている…！${C.reset}`);
      console.log(
        `  ${C.yellow}[fight]${C.reset}ゾーマに挑む` +
        `  ${C.yellow}[s]${C.reset}みなみ（洞窟へ）` +
        `  ${C.yellow}[st]${C.reset}ステータス` +
        `  ${C.yellow}[save]${C.reset}セーブ`
      );
      const cmd = await ask('> ');
      if (cmd === 'fight') {
        if (!bossGreeted) {
          bossGreeted = true;
          console.log('');
          await typewrite(
            `${C.boldRed}ゾーマ：${C.reset}` +
            `「ふははは！よくぞここまで来たな、${player.name}よ！\n` +
            `  この私を倒せると思っておるか？愚か者め！」`,
            20
          );
        }
        const result = await battle(player, 'zoma');
        if      (result === 'win')  { await ending(player); return; }
        else if (result === 'dead') { await gameOver(player); return; }
        // fled → stay in demoncastle
      } else if (cmd === 's')    { player.location = 'cave'; }
      else if   (cmd === 'st')   { showStatusDetail(player); }
      else if   (cmd === 'save') { saveGame(player); }
      else if   (cmd === 'load') { await tryLoad(player); }
      else if   (cmd === 'map')  { console.log(MAP_ART); }
      continue;
    }

    // ─── 通常移動エリア（草原・洞窟） ────────────────────────────────────
    const exitParts = [];
    if (area.exits.n) exitParts.push(`${C.yellow}[n]${C.reset}きた`);
    if (area.exits.s) exitParts.push(`${C.yellow}[s]${C.reset}みなみ`);
    console.log(
      `  ${exitParts.join('  ')}` +
      `  ${C.yellow}[st]${C.reset}ステータス` +
      `  ${C.yellow}[save]${C.reset}セーブ` +
      `  ${C.yellow}[load]${C.reset}ロード` +
      `  ${C.yellow}[map]${C.reset}マップ` +
      `  ${C.yellow}[q]${C.reset}おわる`
    );

    const cmd = await ask('> ');

    if ((cmd === 'n' && area.exits.n) || (cmd === 's' && area.exits.s)) {
      const dest = cmd === 'n' ? area.exits.n : area.exits.s;
      player.location = dest;

      // ランダムエンカウント（移動元エリアで判定）
      if (area.encounter && Math.random() < area.encounterRate) {
        const key    = area.enemies[rand(0, area.enemies.length - 1)];
        const result = await battle(player, key);
        if      (result === 'dead') { await gameOver(player); return; }
        // win / fled → 続行
      }

    } else if (cmd === 'st')   { showStatusDetail(player); }
    else if   (cmd === 'save') { saveGame(player); }
    else if   (cmd === 'load') { await tryLoad(player); }
    else if   (cmd === 'map')  { console.log(MAP_ART); }
    else if   (cmd === 'q')    { console.log(C.dim + 'またね！' + C.reset); rl.close(); return; }
  }
}

async function tryLoad(player) {
  const saved = loadGame();
  if (saved) {
    Object.assign(player, saved);
    await typewrite(`${C.boldCyan}✦ ${saved.name} のデータをロードしました。${C.reset}`);
  } else {
    await typewrite(`${C.red}セーブデータが見つかりません。${C.reset}`);
  }
}

// ─── 新しいゲーム ──────────────────────────────────────────────────────────
async function newGame() {
  const name   = await askRaw(`\n${C.boldYellow}なまえを おしえてください：${C.reset} `);
  const player = createPlayer(name || '勇者');
  console.log('');
  await typewrite(`${C.yellow}${player.name}よ、旅に出よ！魔王ゾーマを倒し世界を救え！${C.reset}`, 20);
  await typewrite(
    `${C.dim}ヒント: みせ(やくそう)・やど(回復)・save/loadが使えます。${C.reset}`,
    12
  );
  await sleep(500);
  await gameLoop(player);
}

// ─── タイトル画面 ──────────────────────────────────────────────────────────
async function title() {
  console.clear();
  console.log('\n');
  console.log(C.boldYellow + [
    '  ██████╗  ██████╗       ██╗',
    '  ██╔══██╗██╔═══██╗    ███║',
    '  ██║  ██║██║   ██║     ██║',
    '  ██║  ██║██║▄▄ ██║     ██║',
    '  ██████╔╝╚██████╔╝     ██║',
    '  ╚═════╝  ╚══▀▀═╝      ╚═╝',
  ].join('\n') + C.reset);
  console.log('');
  console.log(C.boldWhite + '      D R A G O N   Q U E S T   I' + C.reset);
  console.log(C.dim       + '           ─── テキスト版 ───' + C.reset);
  console.log('');
  await sleep(300);
  await typewrite(`  ${C.yellow}魔王ゾーマが世界を闇に包んでいる。${C.reset}`, 25);
  await typewrite(`  ${C.white}ひとりの勇者が立ち上がった…${C.reset}`, 25);
  console.log('');
  console.log(
    `  ${C.yellow}[n]${C.reset}はじめから` +
    `  ${C.yellow}[l]${C.reset}つづきから` +
    `  ${C.yellow}[q]${C.reset}おわる`
  );
  console.log('');
}

// ─── エントリーポイント ────────────────────────────────────────────────────
async function main() {
  await title();
  const choice = await ask('> ');

  if (choice === 'q') {
    console.log(C.dim + 'またね！' + C.reset);
    rl.close();
    return;
  }

  if (choice === 'l') {
    const saved = loadGame();
    if (saved) {
      await typewrite(`${C.boldCyan}✦ ${saved.name} のデータをロードしました。${C.reset}`);
      await sleep(500);
      await gameLoop(saved);
    } else {
      await typewrite(`${C.red}セーブデータが見つかりません。新しいゲームを始めます。${C.reset}`);
      await sleep(1000);
      await newGame();
    }
    return;
  }

  // 'n' または不明 → 新しいゲーム
  await newGame();
}

main().catch((err) => {
  // readline.close() 後の入力エラーは正常終了
  if (err && (err.code === 'ERR_USE_AFTER_CLOSE' || err.message?.includes('readline'))) return;
  console.error(err);
  process.exit(1);
});
