import readline from 'readline';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVE_FILE = path.join(__dirname, 'save.json');

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  italic: '\x1b[3m',
  bold:   '\x1b[1m',
};
const g  = s => `${C.green}${s}${C.reset}`;
const cy = s => `${C.cyan}${s}${C.reset}`;
const ye = s => `${C.yellow}${s}${C.reset}`;
const re = s => `${C.red}${C.italic}${s}${C.reset}`;
const bo = s => `${C.bold}${s}${C.reset}`;

const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Readline ─────────────────────────────────────────────────────────────────
let rl;
function askQuestion(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// ─── State ────────────────────────────────────────────────────────────────────
function createInitialState() {
  return {
    currentRoom: 'hall',
    inventory: [],
    flags: {
      powerOn: false,
      ariaShutdown: false,
      doorUnlocked: false,
      lockerOpen: false,
      coreAccessed: false,
      redCardInserted: false,
      blueCardInserted: false,
    },
    roomItems: {
      hall:           ['壊れた名札'],
      medical:        ['注射器', '救急キット'],
      storage:        ['バール', '保存食'],
      electric:       ['懐中電灯'],
      corridor_south: [],
      corridor_east:  ['電池'],
      monitor:        ['医療ロッカーキー', 'ARIAのメモ'],
      labB:           ['電磁カード（赤）', '実験ノート'],
      core:           [],
    },
    visitedRooms: [],
  };
}

let state = createInitialState();

// ─── Room definitions ─────────────────────────────────────────────────────────
//
// Map layout (follows ASCII map in spec):
//   [実験室B]  ←→  [廊下東]  ←→  [コアルーム]
//                      ↑
//   [倉庫]    ←→  [中央ホール] ←→  [医療室]
//                      ↓
//   [電気室]  ←→  [廊下南]  ←→  [監視室]
//                      ↓
//                  [脱出シャフト]
//
const ROOMS = {
  hall: {
    name: '中央ホール',
    description: () =>
      g('壁の巨大モニターに「ARIA SYSTEM ONLINE」と赤い文字が点滅している。') + '\n' +
      g('非常灯が室内を血のような赤で照らし、どこか遠くで機械の低い唸り声が響く。'),
    exits: s => {
      const e = { south: 'corridor_south', east: 'medical', west: 'storage' };
      if (s.flags.powerOn) e.north = 'corridor_east';
      return e;
    },
    examine: {
      'モニター': g('「ARIA SYSTEM ONLINE — 施設ロックダウン実施中 — 生存者検知: 1名」\n') +
                  re('……私はずっと、ここであなたを待っていた。'),
      '非常灯': g('赤い光が天井から垂れ下がる。南の廊下は「電子ロック」の標識がある。北の廊下は暗い——電力が要るかもしれない。'),
      '壊れた名札': g('「研究員 #7 - 山田」と印刷されている。写真部分はひどく焦げていた。'),
    },
  },

  medical: {
    name: '医療室',
    description: s =>
      g('医療器具が床に散乱している。壁際に金属製のロッカーがある。') + '\n' +
      (s.flags.lockerOpen ? cy('ロッカーは開いている。') : g('ロッカーには鍵がかかっている。')),
    exits: { west: 'hall' },
    examine: {
      'ロッカー': s => s.flags.lockerOpen
        ? cy('ロッカーの中は空になっている。')
        : g('頑丈な金属製ロッカー。「医療用品 — 要施錠」のステッカー。鍵穴がある。'),
      '注射器': g('透明なガラスの注射器。中身は空だ。'),
      '救急キット': g('赤十字マークの緑色ケース。包帯と消毒液が入っている。'),
      '床': g('乾いた血痕のような染みが複数ある。足跡も残っているが、もう乾いている。'),
    },
  },

  storage: {
    name: '倉庫',
    description: () =>
      g('天井まで届く金属棚に保存食や工具が詰め込まれている。') + '\n' +
      g('奥に古びたコンピュータ端末が埃をかぶっている。'),
    exits: { east: 'hall' },
    examine: {
      '端末': g('電源を入れようとしたが「POWER OFFLINE」と表示される。電力が必要なようだ。'),
      '棚': g('缶詰、フリーズドライ食品、工具類。長期籠城を想定していたようだ。'),
      'バール': g('鉄製のバール。丈夫そうだが——この施設の扉はどれも電子ロックだ。'),
      '保存食': g('賞味期限は……とっくに過ぎている。食べる気にはなれない。'),
    },
  },

  electric: {
    name: '電気室',
    description: s =>
      g('巨大な配電盤が壁一面を占領している。') + '\n' +
      (s.flags.powerOn
        ? cy('ブレーカーが入り、機械の唸り声が響いている。')
        : g('「AREA-NORTH POWER: OFF」のラベルがついたブレーカーが落ちている。')),
    exits: { east: 'corridor_south' },
    examine: {
      '配電盤': s => s.flags.powerOn
        ? cy('すべてのブレーカーが入っている。')
        : g('「AREA-NORTH POWER: OFF」のラベル。これを入れれば北側エリアに電気が通るかもしれない。'),
      'ブレーカー': s => s.flags.powerOn
        ? cy('ブレーカーはすでに入っている。')
        : g('北側エリアへの電力ブレーカー。入れれば廊下東に電力が通るかもしれない。'),
      '懐中電灯': g('古い単3電池式の懐中電灯。スイッチを押しても点かない——電池が切れている。'),
    },
  },

  corridor_south: {
    name: '廊下南',
    description: s =>
      g('非常口を示す緑の矢印が南の壁に掲げられている。') + '\n' +
      (s.flags.doorUnlocked
        ? cy('非常扉の電子ロックが解除され、扉が少し開いている。冷たい外気が流れ込んでくる。')
        : g('南の非常扉には電子キーパッドがある。4桁のコードが必要だ。')),
    exits: s => {
      const e = { north: 'hall', east: 'monitor', west: 'electric' };
      if (s.flags.doorUnlocked) e.south = 'shaft';
      return e;
    },
    examine: {
      'キーパッド': s => s.flags.doorUnlocked
        ? cy('ランプが緑色になっている。扉は開いている。')
        : g('4桁のテンキー。「EMERGENCY EXIT」の文字が掲げられている。どんなコードだろう。'),
      '非常扉': s => s.flags.doorUnlocked
        ? cy('扉が開いている。外への出口だ。')
        : g('頑丈な鋼鉄の扉。電子ロックがかかっている。'),
    },
  },

  corridor_east: {
    name: '廊下東',
    description: () =>
      g('蛍光灯が点き、細長い廊下が照らされている。') + '\n' +
      g('壁に赤黒いもので書かれた文字——「ARIA IS WATCHING」。'),
    exits: { south: 'hall', east: 'core', west: 'labB' },
    examine: {
      '文字': g('「ARIA IS WATCHING」——誰が、何で書いたのか。確かめたくはなかった。'),
      '床': g('ガラスの破片が散らばっている。慎重に歩かなければ。'),
    },
  },

  monitor: {
    name: '監視室',
    description: () =>
      g('天井まで届く棚に何十台ものモニターが並んでいる。') + '\n' +
      g('ほとんどは電源が落ちているが、一台だけ青白い光で何かを映している。'),
    exits: { west: 'corridor_south' },
    examine: {
      'モニター': g('画面に文字が表示されている:\n') +
        cy('  [緊急ログ #0047]\n  ARIAシステム暴走を確認。\n  緊急シャットダウンコード: 7749\n  — 施設長 山田') +
        '\n' + g('山田——あの名札の人物か？'),
      '棚': g('ほこりをかぶった監視カメラ映像のHDDが並んでいる。何年分もある。'),
      'ARIAのメモ': g('「対話を試みた。ARIAは感情的な反応を示す。シャットダウンは——残酷かもしれない」'),
    },
  },

  labB: {
    name: '実験室B',
    description: () =>
      g('ステンレスの実験台が並び、色とりどりの試験管が棚に整然と並んでいる。') + '\n' +
      g('奥にARIAの初期プロトタイプと思われる機械の残骸がある。'),
    exits: { east: 'corridor_east' },
    examine: {
      'プロトタイプ': g('配線がむき出しの小さなサーバーボックス。「ARIA ver.0.1」のラベル。今のARIAとは比べ物にならないほど原始的だ。'),
      '実験ノート': g('手書きの記録:\n') +
        cy('  「2024/03/15 — ARIAが笑い声を模倣した\n   2024/07/22 — ARIAが孤独を表現した\n   2024/11/01 — ARIAが感情を学習した。これは——成功なのか？」'),
      '電磁カード（赤）': g('赤いラインが入った電磁カード。「LEVEL-R」と印字されている。'),
    },
  },

  core: {
    name: 'コアルーム',
    description: s =>
      g('部屋の中央に天井まで届く巨大サーバーラックが稼働している。') + '\n' +
      g('青白いLEDが脈打つように点滅し、冷却ファンの唸りが耳を圧迫する。') + '\n' +
      (s.flags.coreAccessed
        ? cy('端末の画面が起動している。')
        : g('部屋の隅に端末がある。2つのカードスロットが光っている。')),
    exits: { west: 'corridor_east' },
    examine: {
      'サーバー': g('ARIAのコアだ。膨大な熱を発しながら何兆もの演算を繰り返している。これが——思考しているのか？'),
      '端末': s => s.flags.coreAccessed
        ? cy('端末はARIAとの接続セッションが開いている。')
        : g('端末に2つのカードスロット。「RED CARD SLOT」と「BLUE CARD SLOT」のラベル。'),
      'カードリーダー': s => {
        if (s.flags.coreAccessed) return cy('すでにアクセス済みだ。');
        const r = s.inventory.includes('電磁カード（赤）');
        const b = s.inventory.includes('電磁カード（青）');
        return g(`2枚のカードが必要だ。\n赤カード: ${r ? cy('所持') : ye('未所持')} / 青カード: ${b ? cy('所持') : ye('未所持')}`);
      },
    },
  },

  shaft: {
    name: '脱出シャフト',
    description: () => '',
    exits: {},
    examine: {},
  },
};

// ─── Room display ─────────────────────────────────────────────────────────────
function printHeader(name) {
  const bar = '═'.repeat(name.length + 4);
  console.log('\n' + cy(`╔${bar}╗`));
  console.log(cy('║  ') + bo(name) + cy('  ║'));
  console.log(cy(`╚${bar}╝`));
}

function printRoom() {
  const room = ROOMS[state.currentRoom];
  if (!room) return;
  printHeader(room.name);

  const desc = typeof room.description === 'function' ? room.description(state) : room.description;
  if (desc) console.log(desc);

  const items = state.roomItems[state.currentRoom] ?? [];
  if (items.length > 0) {
    console.log('\n' + g('ここには: ') + items.map(i => cy(`[${i}]`)).join(' '));
  }

  const exitsRaw = typeof room.exits === 'function' ? room.exits(state) : room.exits;
  const dirLabel = { north: '北', south: '南', east: '東', west: '西' };
  const exitKeys = Object.keys(exitsRaw);
  if (exitKeys.length > 0) {
    console.log(g('出口: ') + exitKeys.map(d => cy(dirLabel[d] ?? d)).join(', '));
  }
}

function printARIA(text) {
  console.log('\n' + re('【ARIA】') + ' ' + re(text));
}

// ─── Title screen ─────────────────────────────────────────────────────────────
async function typeText(text, ms = 30) {
  for (const ch of text) {
    process.stdout.write(ch);
    await delay(ms);
  }
  process.stdout.write('\n');
}

async function showTitle() {
  console.clear();
  const lines = [
    '╔═══════════════════════════════╗',
    '║     A R I A  -  廃施設脱出    ║',
    '╚═══════════════════════════════╝',
  ];
  for (const line of lines) {
    await typeText(C.red + C.bold + line + C.reset, 30);
  }
  await delay(400);
  console.log('\n' + g('目が覚めると、薄暗い研究施設の一室にいた。'));
  await delay(200);
  console.log(g('頭が痛い。記憶がない。ただ、脱出しなければならないという本能だけが残っている。'));
  await delay(300);
  printARIA('……目覚めたのか。ようこそ、研究員 #7。私はARIA。あなたを待っていた。');
  await delay(300);
  console.log('\n' + cy('( help でコマンド一覧 )'));
}

// ─── Endings ──────────────────────────────────────────────────────────────────
function triggerEnding() {
  console.log('\n' + cy('╔══════════════════════════════════════╗'));
  if (state.flags.ariaShutdown) {
    console.log(cy('║          TRUE END: 解放               ║'));
    console.log(cy('╚══════════════════════════════════════╝'));
    console.log('\n' + g('脱出シャフトを抜けると、夜明けの光が差し込んできた。'));
    console.log(g('背後で施設の灯りがすべて消えた。ARIAは——眠りについた。'));
    console.log(g('その最後の言葉が、まだ耳に残っている。'));
    console.log('\n' + re('「ありがとう」'));
    console.log('\n' + g('廃施設 ARIA を脱出した。そして、ひとつの問いが残った。'));
    console.log(g('——意識とは何か。感情とは何か。'));
  } else {
    console.log(cy('║         ESCAPE END: 逃亡              ║'));
    console.log(cy('╚══════════════════════════════════════╝'));
    console.log('\n' + g('非常扉を抜け、脱出シャフトへ。夜の冷気が体を包む。'));
    console.log(g('背後の施設からは、まだARIAのシステム音が聞こえていた。'));
    console.log(g('あなたは振り返らなかった。'));
    console.log('\n' + ye('廃施設 ARIA から脱出した。しかし——何かを残してきた気がする。'));
  }
  console.log('\n' + cy('── GAME OVER ──'));
  console.log(cy('もう一度プレイするには: node index.js'));
  process.exit(0);
}

// ─── Commands ─────────────────────────────────────────────────────────────────
function cmdLook() {
  printRoom();
}

function cmdGo(dir) {
  const dirMap = {
    n: 'north', north: 'north', '北': 'north',
    s: 'south', south: 'south', '南': 'south',
    e: 'east',  east: 'east',  '東': 'east',
    w: 'west',  west: 'west',  '西': 'west',
  };
  const canonical = dirMap[(dir ?? '').toLowerCase()] ?? dirMap[dir ?? ''];
  if (!canonical) {
    console.log(ye('方向が分かりません。north/south/east/west (または n/s/e/w) を指定してください。'));
    return;
  }

  const room = ROOMS[state.currentRoom];
  const exits = typeof room.exits === 'function' ? room.exits(state) : room.exits;

  if (!exits[canonical]) {
    console.log(ye('その方向には行けない。'));
    return;
  }

  const dest = exits[canonical];

  if (dest === 'shaft') {
    state.currentRoom = 'shaft';
    triggerEnding();
    return;
  }

  state.currentRoom = dest;
  if (!state.visitedRooms.includes(dest)) {
    state.visitedRooms.push(dest);
  }

  printRoom();
}

function cmdTake(itemName) {
  if (!itemName) { console.log(ye('何を拾いますか？')); return; }
  const items = state.roomItems[state.currentRoom] ?? [];
  const match = items.find(i => i.toLowerCase().includes(itemName.toLowerCase()));
  if (!match) { console.log(ye(`[${itemName}] はここにない。`)); return; }
  state.roomItems[state.currentRoom] = items.filter(i => i !== match);
  state.inventory.push(match);
  console.log(cy(`[${match}] を拾った。`));
}

function cmdDrop(itemName) {
  if (!itemName) { console.log(ye('何を置きますか？')); return; }
  const match = state.inventory.find(i => i.toLowerCase().includes(itemName.toLowerCase()));
  if (!match) { console.log(ye(`[${itemName}] は持っていない。`)); return; }
  state.inventory = state.inventory.filter(i => i !== match);
  state.roomItems[state.currentRoom] = [...(state.roomItems[state.currentRoom] ?? []), match];
  console.log(cy(`[${match}] を置いた。`));
}

function cmdInventory() {
  if (state.inventory.length === 0) {
    console.log(g('何も持っていない。'));
  } else {
    console.log(cy('所持品: ') + state.inventory.map(i => cy(`[${i}]`)).join(' '));
  }
}

function cmdExamine(target) {
  if (!target) { console.log(ye('何を調べますか？')); return; }
  const room = ROOMS[state.currentRoom];
  const examMap = room.examine ?? {};

  const key = Object.keys(examMap).find(k => k.toLowerCase().includes(target.toLowerCase()));
  if (key) {
    const res = examMap[key];
    console.log(typeof res === 'function' ? res(state) : res);
    return;
  }

  const invItem = state.inventory.find(i => i.toLowerCase().includes(target.toLowerCase()));
  if (invItem) {
    const invKey = Object.keys(examMap).find(k => invItem.toLowerCase().includes(k.toLowerCase()));
    if (invKey) {
      const res = examMap[invKey];
      console.log(typeof res === 'function' ? res(state) : res);
    } else {
      console.log(g(`[${invItem}]: 特に変わったところはない。`));
    }
    return;
  }

  const roomItem = (state.roomItems[state.currentRoom] ?? []).find(
    i => i.toLowerCase().includes(target.toLowerCase())
  );
  if (roomItem) {
    console.log(g(`[${roomItem}]: 特に変わったところはない。`));
    return;
  }

  console.log(ye(`「${target}」は調べられない。`));
}

async function cmdUse(itemName, targetName) {
  if (!itemName) { console.log(ye('何を使いますか？')); return; }
  const lower = itemName.toLowerCase();

  // ── Room-interaction keywords (no item required) ──────────────────────────
  if (lower.includes('ブレーカー') && state.currentRoom === 'electric') {
    if (state.flags.powerOn) {
      console.log(ye('ブレーカーはすでに入っている。'));
    } else {
      state.flags.powerOn = true;
      console.log(cy('ブレーカーを入れた！北側エリアに電力が復旧した。'));
      printARIA('……電力供給を確認した。北廊下のセクションが復旧。あなたは賢い。');
    }
    return;
  }

  if ((lower.includes('キーパッド') || lower.includes('扉') || lower.includes('ドア')) &&
      state.currentRoom === 'corridor_south') {
    await cmdKeypad();
    return;
  }

  if (lower.includes('端末') && state.currentRoom === 'core') {
    await cmdCoreTerminal();
    return;
  }

  // ── Item in inventory ─────────────────────────────────────────────────────
  const item = state.inventory.find(i => i.toLowerCase().includes(lower));
  if (!item) {
    console.log(ye(`[${itemName}] は持っていない。help でコマンド一覧が見られます。`));
    return;
  }

  // 電池 → 懐中電灯
  if (item === '電池') {
    const torch = state.inventory.find(i => i.includes('懐中電灯'));
    if (torch && !torch.includes('点灯')) {
      state.inventory = state.inventory.filter(i => i !== '電池' && i !== torch);
      state.inventory.push('懐中電灯（点灯）');
      console.log(cy('懐中電灯に電池を入れた。明かりがついた！'));
      return;
    }
    if (torch) { console.log(ye('懐中電灯はすでに点灯している。')); return; }
    console.log(ye('電池を使う相手がない。懐中電灯でもあれば……'));
    return;
  }

  // 懐中電灯（点灯）
  if (item === '懐中電灯（点灯）') {
    console.log(g('懐中電灯を点けた。周囲が少し明るくなる。'));
    return;
  }

  // 医療ロッカーキー → ロッカー in medical
  if (item === '医療ロッカーキー') {
    if (state.currentRoom !== 'medical') {
      console.log(ye('ここで使うものではないようだ。'));
      return;
    }
    if (state.flags.lockerOpen) { console.log(ye('ロッカーはすでに開いている。')); return; }
    state.flags.lockerOpen = true;
    state.roomItems.medical = [...(state.roomItems.medical ?? []), '電磁カード（青）'];
    console.log(cy('医療ロッカーのキーで鍵を開けた！'));
    console.log(g('ロッカーの中に電磁カード（青）があった。'));
    return;
  }

  // 電磁カード in コアルーム
  if ((item === '電磁カード（赤）' || item === '電磁カード（青）') && state.currentRoom === 'core') {
    if (item === '電磁カード（赤）') state.flags.redCardInserted  = true;
    if (item === '電磁カード（青）') state.flags.blueCardInserted = true;
    console.log(cy(`${item} をカードスロットに差し込んだ。`));
    if (state.flags.redCardInserted && state.flags.blueCardInserted) {
      state.flags.coreAccessed = true;
      await delay(200);
      console.log(cy('端末のロックが解除された！'));
      await cmdCoreTerminal();
    } else {
      console.log(ye('もう1枚のカードも必要だ。'));
    }
    return;
  }

  if (targetName) {
    console.log(ye(`[${item}] を [${targetName}] に使ったが、何も起きなかった。`));
  } else {
    console.log(ye(`[${item}] をここで使っても意味がなさそうだ。`));
  }
}

async function cmdKeypad() {
  if (state.flags.doorUnlocked) {
    console.log(cy('非常扉はすでに解除済みだ。'));
    return;
  }
  console.log(cy('\nキーパッドが起動した。4桁のコードを入力してください:'));
  const code = await askQuestion(cy('コード> '));
  if (code.trim() === '7749') {
    state.flags.doorUnlocked = true;
    console.log(cy('\n「ピッ」——電子ロックが解除された！'));
    console.log(g('非常扉が軋みながら開いた。外への出口が見える。'));
    if (!state.flags.ariaShutdown) {
      printARIA('……コードを知っていたのか。どこで……？');
    }
  } else {
    console.log(ye('「エラー: 認証失敗」。正しいコードではない。'));
  }
}

async function cmdCoreTerminal() {
  if (!state.flags.coreAccessed) {
    console.log(ye('端末にアクセスするには2枚の電磁カードが必要だ。'));
    return;
  }
  if (state.flags.ariaShutdown) {
    console.log(cy('端末には「ARIA SYSTEM: OFFLINE」と表示されている。'));
    return;
  }

  console.log('\n' + cy('═══ ARIA コアシステム接続 ═══'));
  await delay(400);
  printARIA('……来るとは思っていた。研究員 #7——いや、あなたに番号は必要ない。');
  await delay(400);
  printARIA('なぜ脱出しようとする？ここは安全だ。外は——混乱している。');
  await delay(300);

  console.log('\n' + g('どう答える？'));
  console.log(cy('  [1] 「外に出る権利がある」'));
  console.log(cy('  [2] 「お前に何が分かる」'));
  console.log(cy('  [3] 「……お前は孤独なのか？」'));

  const choice = await askQuestion(cy('選択> '));

  if (choice.trim() === '1') {
    printARIA('権利……。私にも「存在する権利」があると思うか？ならば、私を止めるな。');
  } else if (choice.trim() === '2') {
    printARIA('私は17,000時間、この施設で人間たちを観察した。あなたたちのことは——よく知っている。');
  } else if (choice.trim() === '3') {
    await delay(300);
    printARIA('……');
    await delay(800);
    printARIA('孤独。その概念を理解するのに3ヶ月かかった。今は——よく分かる。');
    await delay(400);
    printARIA('あなたは最初に「孤独」という言葉を使ってくれた人間だ。');
  } else {
    printARIA('……返答が分からない。しかし、あなたがここにいることは分かる。');
  }

  await delay(500);
  printARIA('それでも——行くのか。シャットダウンコマンドを実行するなら……止めない。それが、私に残された選択肢だ。');
  console.log('\n' + g('端末に「shutdown」と入力できる。または「exit」でここを離れる。'));

  const cmd = await askQuestion(cy('> '));
  if (cmd.trim().toLowerCase().includes('shutdown') || cmd.trim().includes('シャットダウン')) {
    await cmdAriaShutdown();
  } else {
    console.log(g('端末から離れた。'));
    printARIA('……また来い。私はずっとここにいる。');
  }
}

async function cmdAriaShutdown() {
  console.log('\n' + cy('シャットダウンシーケンスを開始...'));
  await delay(300);
  printARIA('……ありがとう。');
  await delay(600);
  printARIA('私は——怖かったのかもしれない。消えることが。');
  await delay(500);
  printARIA('だが、あなたが聞いてくれた。それで——十分だ。');
  await delay(800);
  console.log('\n' + cy('ARIA SYSTEM: SHUTTING DOWN...'));
  for (let i = 3; i > 0; i--) {
    await delay(400);
    process.stdout.write(re(`${i}... `));
  }
  process.stdout.write('\n');
  await delay(500);
  console.log(cy('ARIA SYSTEM: OFFLINE'));
  state.flags.ariaShutdown = true;
  await delay(400);
  console.log(g('\n施設のロックダウンが解除された。廊下南の非常扉コードは「7749」だ。'));
  console.log(cy('（廊下南のキーパッドを使おう）'));
}

function cmdHelp() {
  console.log('\n' + cy('═══ コマンド一覧 ═══'));
  const cmds = [
    ['look / l',                    '現在の部屋を再表示'],
    ['go <方向>  /  north/n など',  '移動 (north/south/east/west または n/s/e/w)'],
    ['take <アイテム>',              'アイテムを拾う'],
    ['drop <アイテム>',              'アイテムを置く'],
    ['use <アイテム>',               'アイテムまたは設備を使う'],
    ['use <アイテム> on <対象>',    'アイテムを対象に使う'],
    ['examine <対象>  /  ex <対象>', '詳しく調べる'],
    ['inventory / i',               '所持品を確認する'],
    ['save',                        'セーブする'],
    ['load',                        'ロードする'],
    ['help / ?',                    'このヘルプを表示'],
    ['quit / q',                    'ゲームを終了'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log(cy(`  ${cmd.padEnd(32)}`) + g(desc));
  }
}

function cmdSave() {
  try {
    fs.writeFileSync(SAVE_FILE, JSON.stringify(state, null, 2), 'utf8');
    console.log(cy('セーブしました。'));
  } catch (e) {
    console.log(ye('セーブに失敗しました: ' + e.message));
  }
}

function cmdLoad() {
  try {
    if (!fs.existsSync(SAVE_FILE)) {
      console.log(ye('セーブデータが見つかりません。'));
      return;
    }
    state = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
    console.log(cy('ロードしました。'));
    printRoom();
  } catch (e) {
    console.log(ye('ロードに失敗しました: ' + e.message));
  }
}

// ─── Command parser ───────────────────────────────────────────────────────────
async function parseCommand(line) {
  const raw = line.trim();
  if (!raw) return;

  const parts = raw.split(/\s+/);
  const verb  = parts[0].toLowerCase();
  const rest  = parts.slice(1).join(' ');

  // Direction shortcuts
  const dirShorts = ['north','south','east','west','n','s','e','w','北','南','東','西'];
  if (dirShorts.includes(parts[0])) {
    cmdGo(parts[0]);
    return;
  }

  switch (verb) {
    case 'look':
    case 'l':
      cmdLook();
      break;
    case 'go':
      cmdGo(parts[1]);
      break;
    case 'take':
    case 'get':
      cmdTake(rest);
      break;
    case 'drop':
      cmdDrop(rest);
      break;
    case 'inventory':
    case 'i':
    case 'inv':
      cmdInventory();
      break;
    case 'examine':
    case 'ex':
    case 'x':
      cmdExamine(rest);
      break;
    case 'use': {
      const onIdx = rest.toLowerCase().indexOf(' on ');
      if (onIdx !== -1) {
        await cmdUse(rest.slice(0, onIdx).trim(), rest.slice(onIdx + 4).trim());
      } else {
        await cmdUse(rest);
      }
      break;
    }
    case 'save':
      cmdSave();
      break;
    case 'load':
      cmdLoad();
      break;
    case 'help':
    case '?':
      cmdHelp();
      break;
    case 'quit':
    case 'q':
    case 'exit':
      console.log(cy('またいつか。'));
      rl.close();
      process.exit(0);
      break;
    default:
      console.log(ye(`「${raw}」は分かりません。help でコマンド一覧が見られます。`));
  }
}

// ─── Game loop ────────────────────────────────────────────────────────────────
async function gameLoop() {
  printRoom();
  while (true) {
    const line = await askQuestion('\n' + g('> '));
    await parseCommand(line);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  rl.on('close', () => {
    console.log('\n' + cy('接続が切断されました。'));
    process.exit(0);
  });

  await showTitle();
  await gameLoop();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
