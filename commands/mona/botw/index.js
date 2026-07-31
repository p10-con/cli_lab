#!/usr/bin/env node
/**
 * bloom of the wisper（開花のささやき）— 四大神獣と戦うテキストRPG
 * 火山のトカゲ、空に浮かぶ島の鳥、砂漠のラクダ、水の都のゾウを越え、
 * 禍々しい影「ガノンドロス」を倒して世界に光を取り戻せ！
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
  boldMagenta:'\x1b[1;35m',
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
    name: '始まりの村ルーメ',
    desc: '静かな村。旅支度を整える人々の顔にも、遠く見える暗雲への不安がにじむ。',
    color: C.boldCyan,
    encounter: false,
    exits: { n: 'volcano' },
  },
  volcano: {
    id: 'volcano',
    name: '灼熱の火山',
    desc: '溶岩が川のように流れる山肌。熱気の中、鱗を光らせる何かが這いずる音がする…。ゴロンとした岩の体を持つ種族が、ここを拠点に生活している。',
    color: C.boldRed,
    encounter: true,
    encounterRate: 0.40,
    exits: { n: 'sky', s: 'town' },
    enemies: ['lava_lizard', 'inferno_drake'],
  },
  sky: {
    id: 'sky',
    name: '浮遊する空の島',
    desc: '雲海に浮かぶ島々。強い風が吹き抜け、翼のはためく音が頭上から降ってくる…。',
    color: C.boldWhite,
    encounter: true,
    encounterRate: 0.45,
    exits: { n: 'desert', s: 'volcano' },
    enemies: ['gale_sparrow', 'tempest_eagle'],
  },
  desert: {
    id: 'desert',
    name: '果てなき砂漠',
    desc: '見渡す限りの砂丘。照りつける日差しの下、砂を蹴り上げる足音が近づいてくる…',
    color: C.yellow,
    encounter: true,
    encounterRate: 0.50,
    exits: { n: 'watercity', s: 'sky' },
    enemies: ['sand_camel', 'scorching_bactrian'],
  },
  watercity: {
    id: 'watercity',
    name: '水の都アクエリア',
    desc: '運河が張り巡らされた美しい都。だが水面の下から、巨大な影が時おり動く…',
    color: C.boldBlue,
    encounter: true,
    encounterRate: 0.55,
    exits: { n: 'shadowthrone', s: 'desert' },
    enemies: ['spring_calf', 'abyssal_elephant'],
  },
  shadowthrone: {
    id: 'shadowthrone',
    name: '影の座',
    desc: '光の届かない玉座の間。禍々しい影が渦を巻き、大地を蝕む気配が肌を刺す…',
    color: C.boldMagenta,
    encounter: false,
    exits: { s: 'watercity' },
  },
};

const MAP_ART = [
  '',
  C.boldMagenta + '   ╔══════════╗',
  C.boldMagenta + '   ║  影の座  ║' + C.reset,
  '        │',
  C.boldBlue    + '   ╔══════════╗',
  C.boldBlue    + '   ║ 水の都 　║' + C.reset,
  '        │',
  C.yellow      + '   ╔══════════╗',
  C.yellow      + '   ║  砂　漠  ║' + C.reset,
  '        │',
  C.boldWhite   + '   ╔══════════╗',
  C.boldWhite   + '   ║ 空の島 　║' + C.reset,
  '        │',
  C.boldRed     + '   ╔══════════╗',
  C.boldRed     + '   ║  火　山  ║' + C.reset,
  '        │',
  C.boldCyan    + '   ╔══════════╗',
  C.boldCyan    + '   ║ 村 ルーメ ║' + C.reset,
  '',
].join('\n');

// ─── 敵定義 ──────────────────────────────────────────────────────────────
const ENEMY_DEFS = {
  lava_lizard: {
    name: '溶岩トカゲ',
    maxHp: 12, atk: 3, def: 2,
    exp: 5, gold: 4,
    color: C.red,
    art: "  ξ°□°)ξ\n トカゲ",
  },
  inferno_drake: {
    name: '業火のルーダニア',
    maxHp: 22, atk: 11, def: 5,
    exp: 12, gold: 7,
    color: C.boldRed,
    art: " ξ≧∀≦)ξ🔥\n ルーダニア",
  },
  gale_sparrow: {
    name: '小鳥',
    maxHp: 30, atk: 14, def: 6,
    exp: 16, gold: 10,
    color: C.white,
    art: "  ヽ(￣ω￣;)ﾉ\n  小鳥",
  },
  tempest_eagle: {
    name: '天空のメドー',
    maxHp: 45, atk: 18, def: 8,
    exp: 26, gold: 17,
    color: C.boldWhite,
    art: " ＼(◉ω◉)／\n  メドー",
  },
  sand_camel: {
    name: 'すならくだ',
    maxHp: 55, atk: 20, def: 11,
    exp: 34, gold: 22,
    color: C.yellow,
    art: "  (¬-_-)¬\n  すならくだ",
  },
  scorching_bactrian: {
    name: '灼熱のナボリス',
    maxHp: 72, atk: 26, def: 14,
    exp: 48, gold: 30,
    color: C.boldYellow,
    art: " (◣∀◢)ﾉ\n ナボリス",
  },
  spring_calf: {
    name: '泉の子象',
    maxHp: 88, atk: 30, def: 17,
    exp: 62, gold: 40,
    color: C.blue,
    art: "  (^ェ^)⊃\n  子象",
  },
  abyssal_elephant: {
    name: '深淵のルッタ',
    maxHp: 110, atk: 35, def: 20,
    exp: 85, gold: 55,
    color: C.boldBlue,
    art: " ミ(°∀°彡\n ルッタ",
  },
  shadow_king: {
    name: 'ガノンドロス',
    maxHp: 260, atk: 50, def: 26,
    exp: 0, gold: 0,
    color: C.boldMagenta,
    art: " ▓(・_・)▓\n ガノンドロス",
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
  null,                       // index 0 unused
  [0,    16, 10, 5,  8],      // Lv1 initial stats
  [25,   6,  3,  1,  2],
  [60,   6,  3,  2,  2],
  [120,  7,  4,  2,  3],
  [200,  7,  4,  2,  3],
  [310,  8,  5,  3,  3],
  [450,  8,  5,  3,  4],
  [640,  9,  6,  3,  4],
  [880,  9,  6,  4,  4],
  [1180, 10, 7,  4,  5],
  [1550, 10, 7,  4,  5],
  [2000, 11, 8,  5,  5],
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
    items: { apple: 3 },
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
    `${C.yellow}Gold: ${player.gold}G   りんご: ${player.items.apple || 0}個`,
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
      `  ${C.yellow}[1]${C.reset}剣で攻撃` +
      `  ${C.yellow}[2]${C.reset}弓で攻撃` +
      `  ${C.yellow}[3]${C.reset}りんごで回復` +
      `  ${C.yellow}[4]${C.reset}回避`
    );

    const cmd = await ask('せんとう> ');
    console.log('');

    let playerActed = true;
    let playerEvading = false;

    if (cmd === '1') {
      // ─ 剣で攻撃
      const dmg = Math.max(1, player.atk - rand(0, Math.floor(enemy.def / 2)));
      enemy.hp -= dmg;
      await typewrite(
        `${C.boldWhite}${player.name}${C.reset}の剣が閃く！` +
        ` ${enemy.color}${enemy.name}${C.reset}に` +
        ` ${C.boldYellow}${dmg}${C.reset}のダメージ！`
      );

    } else if (cmd === '2') {
      // ─ 弓で攻撃（防御力を貫きやすいが威力はやや低い）
      const dmg = Math.max(1, Math.floor(player.atk * 0.8) - rand(0, Math.floor(enemy.def / 4)));
      enemy.hp -= dmg;
      await typewrite(
        `${C.boldWhite}${player.name}${C.reset}が矢を放つ！` +
        ` ${enemy.color}${enemy.name}${C.reset}に` +
        ` ${C.boldYellow}${dmg}${C.reset}のダメージ！`
      );

    } else if (cmd === '3') {
      // ─ りんごで回復
      const count = player.items.apple || 0;
      if (count <= 0) {
        await typewrite(`${C.boldRed}りんごが ない！${C.reset}`);
        playerActed = false;
      } else {
        player.items.apple = count - 1;
        const heal = rand(35, 45);
        const before = player.hp;
        player.hp = clamp(player.hp + heal, 0, player.maxHp);
        await typewrite(
          `りんごを たべた！ HPが ${C.green}${player.hp - before}${C.reset} 回復した！`
        );
      }

    } else if (cmd === '4') {
      // ─ 回避
      playerEvading = true;
      await typewrite(`${C.cyan}${player.name}は身をかがめた！次の攻撃に備える…${C.reset}`);

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

    if (playerEvading) {
      await typewrite(
        `${enemy.color}${enemy.name}${C.reset}の攻撃！` +
        ` ${C.boldCyan}${player.name}${C.reset}は華麗に かわした！`
      );
      continue;
    }

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
  console.log(`  ${C.yellow}[1]${C.reset} りんご        ${C.yellow}30G${C.reset}  （HP回復）`);
  console.log(`  ${C.yellow}[0]${C.reset} でる`);
  console.log(`  ${C.dim}所持金: ${player.gold}G   りんご: ${player.items.apple || 0}個${C.reset}`);

  while (true) {
    const cmd = await ask('みせ> ');
    if (cmd === '1') {
      if (player.gold < 30) {
        await typewrite(`${C.boldRed}ゴールドが足りません！${C.reset}`);
      } else {
        player.gold -= 30;
        player.items.apple = (player.items.apple || 0) + 1;
        await typewrite(
          `${C.green}りんごを 1つ 買いました！` +
          ` (計 ${player.items.apple}個)${C.reset}`
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
    '  ║     ★ ★ CONGRATULATIONS ★ ★      ║',
    '  ║                                  ║',
    '  ╚══════════════════════════════════╝',
  ].join('\n') + C.reset);
  await sleep(1000);
  console.log('');
  await typewrite(`  ${C.boldYellow}${player.name}${C.reset}は ガノンドロスを たおした！`, 35);
  await sleep(400);
  await typewrite(`  大地を蝕んでいた 禍々しい影が はれていく…`, 30);
  await sleep(400);
  await typewrite(`  火山も、空の島も、砂漠も、水の都も、静かな光を取り戻す。`, 30);
  await sleep(600);
  await typewrite(`  「${player.name}よ！四つの試練を越えた、真の勇者よ！`, 25);
  await typewrite(`   世界にふたたび、平穏が訪れた」`, 25);
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

    // ─── 村 ─────────────────────────────────────────────────────────────
    if (player.location === 'town') {
      console.log(
        `  ${C.yellow}[n]${C.reset}きた（火山へ）` +
        `  ${C.yellow}[s]${C.reset}みせ` +
        `  ${C.yellow}[i]${C.reset}やど` +
        `  ${C.yellow}[st]${C.reset}ステータス` +
        `  ${C.yellow}[save]${C.reset}セーブ` +
        `  ${C.yellow}[map]${C.reset}マップ` +
        `  ${C.yellow}[q]${C.reset}おわる`
      );
      const cmd = await ask('> ');
      if      (cmd === 'n')    { player.location = 'volcano'; }
      else if (cmd === 's')    { await shop(player); }
      else if (cmd === 'i')    { await inn(player); }
      else if (cmd === 'st')   { showStatusDetail(player); }
      else if (cmd === 'save') { saveGame(player); }
      else if (cmd === 'load') { await tryLoad(player); }
      else if (cmd === 'map')  { console.log(MAP_ART); }
      else if (cmd === 'q')    { console.log(C.dim + 'またね！' + C.reset); rl.close(); return; }
      continue;
    }

    // ─── 影の座 ─────────────────────────────────────────────────────────
    if (player.location === 'shadowthrone') {
      console.log(`${C.boldMagenta}  ガノンドロスの気配が渦を巻いている…！${C.reset}`);
      console.log(
        `  ${C.yellow}[fight]${C.reset}ガノンドロスに挑む` +
        `  ${C.yellow}[s]${C.reset}みなみ（水の都へ）` +
        `  ${C.yellow}[st]${C.reset}ステータス` +
        `  ${C.yellow}[save]${C.reset}セーブ`
      );
      const cmd = await ask('> ');
      if (cmd === 'fight') {
        if (!bossGreeted) {
          bossGreeted = true;
          console.log('');
          await typewrite(
            `${C.boldMagenta}ガノンドロス：${C.reset}` +
            `「よくぞ四つの試練を越えたな、${player.name}よ！\n` +
            `  だが、この影を打ち払えると思っておるか？愚かな…」`,
            20
          );
        }
        const result = await battle(player, 'shadow_king');
        if      (result === 'win')  { await ending(player); return; }
        else if (result === 'dead') { await gameOver(player); return; }
        // fled → stay in shadowthrone
      } else if (cmd === 's')    { player.location = 'watercity'; }
      else if   (cmd === 'st')   { showStatusDetail(player); }
      else if   (cmd === 'save') { saveGame(player); }
      else if   (cmd === 'load') { await tryLoad(player); }
      else if   (cmd === 'map')  { console.log(MAP_ART); }
      continue;
    }

    // ─── 通常移動エリア（火山・空の島・砂漠・水の都） ────────────────────
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
  await typewrite(`${C.yellow}${player.name}よ、旅に出よ！四つの試練を越え、ガノンドロスを倒せ！${C.reset}`, 20);
  await typewrite(
    `${C.dim}ヒント: みせ(りんご)・やど(回復)・save/loadが使えます。${C.reset}`,
    12
  );
  await sleep(500);
  await gameLoop(player);
}

// ─── タイトル画面 ──────────────────────────────────────────────────────────
async function title() {
  console.clear();
  console.log('\n');
  console.log(C.boldMagenta + [
    '  ██████╗ ██╗      ██████╗  ██████╗ ███╗   ███╗',
    '  ██╔══██╗██║     ██╔═══██╗██╔═══██╗████╗ ████║',
    '  ██████╔╝██║     ██║   ██║██║   ██║██╔████╔██║',
    '  ██╔══██╗██║     ██║   ██║██║   ██║██║╚██╔╝██║',
    '  ██████╔╝███████╗╚██████╔╝╚██████╔╝██║ ╚═╝ ██║',
    '  ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝     ╚═╝',
  ].join('\n') + C.reset);
  console.log(C.boldWhite + '                     OF THE                    ' + C.reset);
  console.log(C.boldMagenta + [
    '  ██╗    ██╗██╗███████╗██████╗ ███████╗██████╗ ',
    '  ██║    ██║██║██╔════╝██╔══██╗██╔════╝██╔══██╗',
    '  ██║ █╗ ██║██║███████╗██████╔╝█████╗  ██████╔╝',
    '  ██║███║██║██║╚════██║██╔═══╝ ██╔══╝  ██╔══██╗',
    '  ╚███╔███╔╝██║███████║██║     ███████╗██║  ██║',
    '   ╚══╝╚══╝ ╚═╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝',
  ].join('\n') + C.reset);
  console.log('');
  await sleep(300);
  await typewrite(`  ${C.boldMagenta}禍々しい影が、大地を蝕んでいる。${C.reset}`, 25);
  await typewrite(`  ${C.white}火山、空の島、砂漠、水の都 — 四つの守護獣を越えた者だけが、${C.reset}`, 20);
  await typewrite(`  ${C.white}影の座に挑むことができるという…${C.reset}`, 25);
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
