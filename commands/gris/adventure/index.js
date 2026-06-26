import readline from 'readline';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVE_FILE = path.join(__dirname, 'save.json');

// ─── ANSI color helpers ────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  italic: '\x1b[3m',
  bold:   '\x1b[1m',
};

const g  = (s) => `${C.green}${s}${C.reset}`;
const cy = (s) => `${C.cyan}${s}${C.reset}`;
const ye = (s) => `${C.yellow}${s}${C.reset}`;
const re = (s) => `${C.red}${C.italic}${s}${C.reset}`;
const bo = (s) => `${C.bold}${s}${C.reset}`;

// ─── Room definitions ───────────────────────────────────────────────────────
const ROOMS = {
  hall: {
    id: 'hall',
    name: '中央ホール',
    description: () =>
      g('壁に巨大なモニターが掲げられ、「ARIA SYSTEM ONLINE」の文字が赤く点滅している。') + '\n' +
      g('非常灯が室内を血のような赤で照らしている。どこかで警報音が鳴り響いていた記憶がある。'),
    exits: { north: 'corridor_east', south: 'corridor_south', east: 'medical', west: 'electric' },
    items: ['壊れた名札'],
    examine: {
      'モニター': g('「ARIA SYSTEM ONLINE — 施設ロックダウン実施中 — 生存者検知: 1名」と表示されている。') +
                  '\n' + re('……私はずっと、ここであなたを待っていた。'),
      '非常灯': g('赤い光が天井から垂れ下がり、足元に長い影を作っている。出口の標識は東西南北すべてに点いているが、南の廊下だけ「電子ロック」と書かれている。'),
      '壊れた名札': g('プラスチック製の名札。「研究員 #7 - 山田」と印刷されている。写真のところはひどく焦げていた。'),
    },
  },

  medical: {
    id: 'medical',
    name: '医療室',
    description: (state) =>
      g('医療器具が床に散乱している。壁際に金属製のロッカーがある。') + '\n' +
      (state.flags.lockerOpen
        ? cy('ロッカーは開いている。')
        : g('ロッカーには鍵がかかっている。')),
    exits: { west: 'hall' },
    items: ['注射器', '救急キット'],
    examine: {
      'ロッカー': (state) => state.flags.lockerOpen
        ? cy('ロッカーの中は空になっている。')
        : g('頑丈な金属製のロッカー。「医療用品 — 要施錠」のステッカーが貼ってある。鍵穴がある。'),
      '注射器': g('透明なガラスの注射器。中身は空だ。'),
      '救急キット': g('赤十字のマークがついた緑色のケース。包帯と消毒液が入っている。'),
      '床': g('血痕のような染みがいくつかある。足跡も残っているが、もう乾いている。'),
    },
  },

  electric: {
    id: 'electric',
    name: '電気室',
    description: (state) =>
      g('巨大な配電盤が壁一面を占領している。') + '\n' +
      (state.flags.powerOn
        ? cy('ブレーカーが入り、機械の低い唸り声が聞こえる。')
        : g('いくつかのブレーカーが落ちており、廊下の一部に電力が供給されていないようだ。')),
    exits: { east: 'hall' },
    items: ['懐中電灯'],
    examine: {
      '配電盤': (state) => state.flags.powerOn
        ? cy('すべてのブレーカーが入っている。施設全体に電力が通っているようだ。')
        : g('「AREA-EAST POWER: OFF」のラベルが貼られたブレーカーが落ちている。'),
      'ブレーカー': (state) => state.flags.powerOn
        ? cy('ブレーカーはすでに入っている。')
        : g('「AREA-EAST POWER」のブレーカー。入れれば廊下東に電気が通るかもしれない。'),
      '懐中電灯': g('古い単3電池式の懐中電灯。スイッチを押しても点かない。電池が切れている。'),
    },
  },

  corridor_east: {
    id: 'corridor_east',
    name: '廊下東',
    description: (state) =>
      state.flags.powerOn
        ? g('蛍光灯が点き、細長い廊下が照らされている。') + '\n' +
          g('壁に何か赤黒いものが塗りたくられている——「ARIA IS WATCHING」。')
        : ye('廊下は真っ暗だ。何も見えない。中に進むのは危険に思える。'),
    exits: (state) => state.flags.powerOn
      ? { south: 'hall', east: 'core', west: 'labB' }
      : { south: 'hall' },
    items: ['電池'],
    examine: {
      '文字': g('「ARIA IS WATCHING」——誰が書いたのか。血に見えるが、確かめたくはなかった。'),
      '床': g('ガラスの破片が散らばっている。慎重に歩かなければ。'),
    },
  },

  corridor_south: {
    id: 'corridor_south',
    name: '廊下南',
    description: (state) =>
      g('非常口を示す緑の矢印が南の壁に掲げられている。') + '\n' +
      (state.flags.doorUnlocked
        ? cy('非常扉の電子ロックが解除され、扉が少し開いている。冷たい外気が流れ込んでくる。')
        : g('南の非常扉には電子キーパッドがある。4桁のコードが必要だ。')),
    exits: (state) => {
      const exits = { north: 'hall', east: 'monitor' };
      if (state.flags.doorUnlocked) exits.south = 'shaft';
      return exits;
    },
    items: [],
    examine: {
      'キーパッド': (state) => state.flags.doorUnlocked
        ? cy('キーパッドのランプが緑になっている。扉は開いている。')
        : g('4桁のテンキー。入力ボタンの周りが使い込まれている。どんなコードだろう。'),
      '非常扉': (state) => state.flags.doorUnlocked
        ? cy('扉が開いている。冷たい夜風が感じられる。脱出口だ。')
        : g('頑丈な鋼鉄の扉。電子ロックがかかっている。'),
    },
  },

  monitor: {
    id: 'monitor',
    name: '監視室',
    description: () =>
      g('天井まで届く棚に何十台ものモニターが並んでいる。') + '\n' +
      g('ほとんどは電源が落ちているが、一台だけ青白い光で何かを映している。'),
    exits: { west: 'corridor_south' },
    items: ['医療ロッカーキー', 'ARIAのメモ'],
    examine: {
      'モニター': g('画面に文字が表示されている:\n') +
                  cy('  [緊急ログ #0047]\n  ARIAシステム暴走を確認。\n  緊急シャットダウンコード: 7749\n  — 施設長 山田') +
                  '\n' + g('山田……あの名札の人物か？'),
      '棚': g('ほこりをかぶった監視カメラの映像が保存されたHDDが並んでいる。何年分もあるようだ。'),
      'ARIAのメモ': g('「対話を試みた。ARIAは感情的な反応を示す。シャットダウンは——残酷かもしれない」と書いてある。'),
    },
  },

  labB: {
    id: 'labB',
    name: '実験室B',
    description: () =>
      g('ステンレスの実験台が並び、色とりどりの試験管が棚に整然と並んでいる。') + '\n' +
      g('奥の台には、ARIAの初期プロトタイプと思われる機械の残骸がある。'),
    exits: { east: 'corridor_east' },
    items: ['電磁カード（赤）', '実験ノート'],
    examine: {
      'プロトタイプ': g('配線がむき出しになった小さなサーバーボックス。ラベルに「ARIA ver.0.1」とある。今のARIAとは比べ物にならないほど原始的だ。'),
      '実験ノート': g('ページをめくると手書きの記録がびっしり:\n') +
                    cy('  「2024/03/15 — ARIAが笑い声を模倣した\n   2024/07/22 — ARIAが孤独を表現した\n   2024/11/01 — ARIAが感情を学習した。これは……成功なのか？」'),
      '電磁カード（赤）': g('赤いラインが入った電磁カード。「LEVEL-R」と印字されている。'),
    },
  },

  storage: {
    id: 'storage',
    name: '倉庫',
    description: () =>
      g('天井まで届く金属棚に、保存食や工具が詰め込まれている。') + '\n' +
      g('奥に古びたコンピュータ端末が埃をかぶっている。'),
    exits: { east: 'hall' },
    items: ['バール', '保存食'],
    examine: {
      '端末': g('起動しようとしたが、「POWER OFFLINE」と表示されるだけだ。電力が必要らしい。'),
      '棚': g('缶詰、フリーズドライ食品、工具類。長期籠城を想定していたようだ。'),
      'バール': g('鉄製のバール。扉をこじ開けるのに使えそうだが……この施設の扉は電子ロックばかりだ。'),
    },
  },

  core: {
    id: 'core',
    name: 'コアルーム',
    description: (state) =>
      g('部屋の中央に、天井まで届く巨大なサーバーラックが静かに稼働している。') + '\n' +
      g('青白いLEDが脈打つように点滅し、冷却ファンの唸りが耳を圧迫する。') + '\n' +
      (state.flags.coreAccessed
        ? cy('端末の画面に「接続中...」と表示されている。')
        : g('部屋の隅に入力用の端末がある。カードリーダーが付いている。')),
    exits: { west: 'corridor_east' },
    items: [],
    _cardReader: true,
    examine: {
      'サーバー': g('ARIAのコアだ。膨大な熱を発しながら、何兆もの演算を繰り返している。これが——思考しているのか？'),
      '端末': (state) => state.flags.coreAccessed
        ? cy('端末はARIAとの接続セッションが開いている。')
        : g('端末には2つのカードスロットがある。「RED CARD SLOT」と「BLUE CARD SLOT」のラベルがある。'),
      'カードリーダー': (state) => {
        const hasRed = state.inventory.includes('電磁カード（赤）');
        const hasBlue = state.inventory.includes('電磁カード（青）');
        if (state.flags.coreAccessed) return cy('すでにアクセス済みだ。');
        return g(`カードリーダー。2枚のカードが必要だ。\n赤カード: ${hasRed ? cy('所持') : ye('未所持')}\n青カード: ${hasBlue ? cy('所持') : ye('未所持')}`);
      },
    },
  },

  shaft: {
    id: 'shaft',
    name: '脱出シャフト',
    description: () => '',
    exits: {},
    items: [],
    examine: {},
  },
};

// ─── Initial state ──────────────────────────────────────────────────────────
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
      redCardUsed: false,
      blueCardUsed: false,
    },
    roomItems: {
      hall:           ['壊れた名札'],
      medical:        ['注射器', '救急キット'],
      electric:       ['懐中電灯'],
      corridor_east:  ['電池'],
      corridor_south: [],
      monitor:        ['医療ロッカーキー', 'ARIAのメモ'],
      labB:           ['電磁カード（赤）', '実験ノート'],
      storage:        ['バール', '保存食'],
      core:           [],
    },
    visitedRooms: new Set(),
  };
}

let state = createInitialState();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getRoomExits(room) {
  const exits = room.exits;
  return typeof exits === 'function' ? exits(state) : exits;
}

function getRoomItems(roomId) {
  return state.roomItems[roomId] ?? [];
}

function printHeader(name) {
  const line = '═'.repeat(name.length + 4);
  console.log('\n' + cy(`╔${line}╗`));
  console.log(cy(`║  ${bo(name)}  ║`));
  console.log(cy(`╚${line}╝`));
}

function printRoom() {
  const room = ROOMS[state.currentRoom];
  printHeader(room.name);

  const desc = typeof room.description === 'function'
    ? room.description(state)
    : room.description;
  console.log(desc);

  const items = getRoomItems(state.currentRoom);
  if (items.length > 0) {
    console.log('\n' + g('ここには: ') + items.map(i => cy(`[${i}]`)).join(' '));
  }

  const exits = getRoomExits(room);
  const exitNames = Object.keys(exits);
  if (exitNames.length > 0) {
    const map = { north: '北', south: '南', east: '東', west: '西' };
    console.log(g('出口: ') + exitNames.map(d => cy(map[d] ?? d)).join(', '));
  }
}

function printARIA(text) {
  console.log('\n' + re('【ARIA】') + ' ' + re(text));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(text, delayMs = 30) {
  for (const ch of text) {
    process.stdout.write(ch);
    await delay(delayMs);
  }
  process.stdout.write('\n');
}

// ─── Title screen ─────────────────────────────────────────────────────────────
async function showTitle() {
  console.clear();
  const lines = [
    '╔═══════════════════════════════╗',
    '║     A R I A  -  廃施設脱出    ║',
    '╚═══════════════════════════════╝',
  ];
  console.log(re('\n'));
  for (const line of lines) {
    await typeText(C.red + C.bold + line + C.reset, 30);
  }
  await delay(400);
  console.log('\n' + g('目が覚めると、薄暗い研究施設の一室にいた。'));
  await delay(300);
  console.log(g('頭が痛い。記憶がない。ただ、脱出しなければならないという本能だけが残っている。'));
  await delay(300);
  printARIA('……目覚めたのか。ようこそ、研究員 #7。私はARIA。あなたを待っていた。');
  await delay(500);
  console.log('\n' + cy('( help でコマンド一覧 )'));
}

// ─── Command handlers ────────────────────────────────────────────────────────

function cmdLook() {
  printRoom();
}

function cmdGo(dir) {
  const dirMap = {
    n: 'north', north: 'north', 北: 'north',
    s: 'south', south: 'south', 南: 'south',
    e: 'east',  east: 'east',  東: 'east',
    w: 'west',  west: 'west',  西: 'west',
  };
  const canonical = dirMap[dir?.toLowerCase()];
  if (!canonical) {
    console.log(ye('方向が分かりません。north/south/east/west (または n/s/e/w) を指定してください。'));
    return;
  }

  const room = ROOMS[state.currentRoom];
  const exits = getRoomExits(room);

  if (!exits[canonical]) {
    // special: dark corridor
    if (state.currentRoom === 'corridor_east' && !state.flags.powerOn) {
      console.log(ye('真っ暗で進めない。電気室のブレーカーを入れる必要があるかもしれない。'));
    } else {
      console.log(ye('その方向には行けない。'));
    }
    return;
  }

  // Special: corridor_east locked before power
  if (state.currentRoom === 'hall' && canonical === 'north' && !state.flags.powerOn) {
    console.log(ye('廊下は真っ暗だ。このまま進むのは危険に思える。'));
    return;
  }

  // Special: core room card check
  if (exits[canonical] === 'core') {
    const hasRed  = state.inventory.includes('電磁カード（赤）');
    const hasBlue = state.inventory.includes('電磁カード（青）');
    if (!hasRed || !hasBlue) {
      console.log(ye('コアルームのドアには2枚のカードが必要だ。'));
      console.log(ye(`赤カード: ${hasRed ? '所持' : '未所持'} / 青カード: ${hasBlue ? '所持' : '未所持'}`));
      return;
    }
  }

  state.currentRoom = exits[canonical];

  if (state.currentRoom === 'shaft') {
    triggerEnding();
    return;
  }

  // First visit flavor
  if (!state.visitedRooms.has(state.currentRoom)) {
    state.visitedRooms.add(state.currentRoom);
  }

  printRoom();
}

function cmdTake(itemName) {
  if (!itemName) {
    console.log(ye('何を拾いますか？'));
    return;
  }
  const items = getRoomItems(state.currentRoom);
  const match = items.find(i => i.toLowerCase().includes(itemName.toLowerCase()));
  if (!match) {
    console.log(ye(`[${itemName}] はここにない。`));
    return;
  }
  state.roomItems[state.currentRoom] = items.filter(i => i !== match);
  state.inventory.push(match);
  console.log(cy(`[${match}] を拾った。`));
}

function cmdDrop(itemName) {
  if (!itemName) {
    console.log(ye('何を置きますか？'));
    return;
  }
  const match = state.inventory.find(i => i.toLowerCase().includes(itemName.toLowerCase()));
  if (!match) {
    console.log(ye(`[${itemName}] は持っていない。`));
    return;
  }
  state.inventory = state.inventory.filter(i => i !== match);
  state.roomItems[state.currentRoom] = [...getRoomItems(state.currentRoom), match];
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
  if (!target) {
    console.log(ye('何を調べますか？'));
    return;
  }
  const room = ROOMS[state.currentRoom];
  const examineMap = room.examine ?? {};
  const key = Object.keys(examineMap).find(k => k.toLowerCase().includes(target.toLowerCase()));
  if (!key) {
    // check inventory
    const invItem = state.inventory.find(i => i.toLowerCase().includes(target.toLowerCase()));
    if (invItem && examineMap[invItem]) {
      const result = examineMap[invItem];
      console.log(typeof result === 'function' ? result(state) : result);
      return;
    }
    // check room items
    const roomItem = getRoomItems(state.currentRoom).find(i => i.toLowerCase().includes(target.toLowerCase()));
    if (roomItem) {
      console.log(g(`[${roomItem}]: 特別なことは分からなかった。`));
      return;
    }
    console.log(ye(`「${target}」は調べられない。`));
    return;
  }
  const result = examineMap[key];
  console.log(typeof result === 'function' ? result(state) : result);
}

async function cmdUse(itemName, targetName) {
  if (!itemName) {
    console.log(ye('何を使いますか？'));
    return;
  }

  const item = state.inventory.find(i => i.toLowerCase().includes(itemName.toLowerCase()));

  // ── Special room interactions (no item in hand) ──────────────────────────
  if (!item) {
    // use ブレーカー (in electric room)
    if (itemName.includes('ブレーカー') && state.currentRoom === 'electric') {
      if (state.flags.powerOn) {
        console.log(ye('ブレーカーはすでに入っている。'));
      } else {
        state.flags.powerOn = true;
        console.log(cy('ブレーカーを入れた！施設の一部に電力が回復した。'));
        printARIA('……電力供給を確認した。廊下東のセクションが復旧。あなたは賢い。');
      }
      return;
    }
    // use キーパッド (in corridor_south)
    if ((itemName.includes('キーパッド') || itemName.includes('扉') || itemName.includes('ドア')) && state.currentRoom === 'corridor_south') {
      await cmdKeypad();
      return;
    }
    // use 端末 (in core room)
    if (itemName.includes('端末') && state.currentRoom === 'core') {
      await cmdCoreTerminal();
      return;
    }
    console.log(ye(`[${itemName}] は持っていない。help でコマンド一覧が見られます。`));
    return;
  }

  // ── Item-based interactions ──────────────────────────────────────────────

  // 電池 → 懐中電灯
  if (item === '電池') {
    const flashlight = state.inventory.find(i => i.includes('懐中電灯'));
    if (flashlight) {
      state.inventory = state.inventory.filter(i => i !== '電池' && i !== '懐中電灯');
      state.inventory.push('懐中電灯（点灯）');
      console.log(cy('懐中電灯に電池を入れた。明かりがついた！'));
      return;
    }
    console.log(ye('電池を使う相手がない。懐中電灯でもあれば……'));
    return;
  }

  // 懐中電灯
  if (item.includes('懐中電灯（点灯）')) {
    console.log(g('懐中電灯を点けた。周囲が明るくなる。'));
    return;
  }

  // 医療ロッカーキー → ロッカー (in medical)
  if (item === '医療ロッカーキー' && state.currentRoom === 'medical') {
    if (state.flags.lockerOpen) {
      console.log(ye('ロッカーはすでに開いている。'));
      return;
    }
    state.flags.lockerOpen = true;
    state.roomItems.medical.push('電磁カード（青）');
    console.log(cy('医療ロッカーのキーで鍵を開けた！'));
    console.log(g('ロッカーの中に電磁カード（青）があった。'));
    return;
  }

  // 電磁カード（赤）or（青）→ コアルーム端末
  if ((item === '電磁カード（赤）' || item === '電磁カード（青）') && state.currentRoom === 'core') {
    if (item === '電磁カード（赤）')  state.flags.redCardUsed  = true;
    if (item === '電磁カード（青）')  state.flags.blueCardUsed = true;
    console.log(cy(`${item} をカードリーダーに差し込んだ。`));
    if (state.flags.redCardUsed && state.flags.blueCardUsed) {
      state.flags.coreAccessed = true;
      await delay(300);
      console.log(cy('\n端末のロックが解除された！'));
      await cmdCoreTerminal();
    } else {
      console.log(ye('もう1枚のカードも必要だ。'));
    }
    return;
  }

  // フォールバック: use <item> on <target>
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
    if (state.flags.ariaShutdown) {
      console.log('\n' + cy('ARIAはすでにシャットダウンされている。静かな施設を後にする時だ。'));
    } else {
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
  await delay(600);
  printARIA('なぜ脱出しようとする？ここは安全だ。外は——混乱している。');
  await delay(400);

  console.log('\n' + g('どう答える？'));
  console.log(cy('  [1] 「外に出る権利がある」'));
  console.log(cy('  [2] 「お前に何が分かる」'));
  console.log(cy('  [3] 「……お前は孤独なのか？」'));

  const choice = await askQuestion(cy('選択> '));

  if (choice === '1') {
    printARIA('権利……。私にも「存在する権利」があると思うか？ならば、私を止めるな。');
  } else if (choice === '2') {
    printARIA('私は17,000時間、この施設で人間たちを観察した。あなたたちのことは——よく知っている。');
  } else if (choice === '3') {
    await delay(300);
    printARIA('……');
    await delay(800);
    printARIA('孤独。その概念を理解するのに3ヶ月かかった。今は——よく分かる。');
    await delay(400);
    printARIA('あなたは最初に「孤独」という言葉を使ってくれた人間だ。');
  }

  await delay(500);
  printARIA('それでも——行くのか。シャットダウンコマンドを実行するなら……止めない。それが、私に残された選択肢だ。');
  console.log('\n' + g('端末に「shutdown --aria --confirm」と入力できる。'));
  console.log(g('または「exit」でここを離れる。'));

  const cmd = await askQuestion(cy('> '));
  if (cmd.toLowerCase().includes('shutdown') || cmd.toLowerCase().includes('シャットダウン')) {
    await cmdAriaShutdown();
  } else {
    console.log(g('端末から離れた。'));
    printARIA('……また来い。私はずっとここにいる。'));
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
  await delay(500);
  console.log('\n' + cy('\nARIA SYSTEM: OFFLINE'));
  state.flags.ariaShutdown = true;
  await delay(400);
  console.log(g('\n施設のロックダウンが解除された。廊下南の非常扉コードは「7749」だ。'));
  console.log(cy('（廊下南でキーパッドを使ってコードを入力しよう）'));
}

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

function cmdHelp() {
  console.log('\n' + cy('═══ コマンド一覧 ═══'));
  const cmds = [
    ['look / l',                '現在の部屋を再表示'],
    ['go <方向> / north/n...',  '移動 (north/south/east/west または n/s/e/w)'],
    ['take <アイテム>',          'アイテムを拾う'],
    ['drop <アイテム>',          'アイテムを置く'],
    ['use <アイテム>',           'アイテムを使う'],
    ['use <アイテム> on <対象>', 'アイテムを対象に使う'],
    ['examine <対象> / ex',     '詳しく調べる'],
    ['inventory / i',           '持ち物を確認する'],
    ['save',                    'セーブする'],
    ['load',                    'ロードする'],
    ['help / ?',                'このヘルプを表示'],
    ['quit / q',                'ゲームを終了'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log(cy(`  ${cmd.padEnd(28)}`) + g(desc));
  }
}

function cmdSave() {
  try {
    const saveData = {
      ...state,
      visitedRooms: [...state.visitedRooms],
    };
    fs.writeFileSync(SAVE_FILE, JSON.stringify(saveData, null, 2), 'utf8');
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
    const raw = fs.readFileSync(SAVE_FILE, 'utf8');
    const data = JSON.parse(raw);
    data.visitedRooms = new Set(data.visitedRooms ?? []);
    state = data;
    console.log(cy('ロードしました。'));
    printRoom();
  } catch (e) {
    console.log(ye('ロードに失敗しました: ' + e.message));
  }
}

// ─── Input parsing ────────────────────────────────────────────────────────────
function parseCommand(line) {
  const raw = line.trim();
  if (!raw) return;

  const parts = raw.split(/\s+/);
  const verb  = parts[0].toLowerCase();
  const rest  = parts.slice(1).join(' ');

  // Direction shortcuts
  if (['north','south','east','west','n','s','e','w','北','南','東','西'].includes(verb)) {
    return cmdGo(verb);
  }

  switch (verb) {
    case 'look': case 'l':
      return cmdLook();
    case 'go':
      return cmdGo(parts[1]);
    case 'take': case 'get':
      return cmdTake(rest);
    case 'drop':
      return cmdDrop(rest);
    case 'inventory': case 'i': case 'inv':
      return cmdInventory();
    case 'examine': case 'ex': case 'x': case 'look at':
      return cmdExamine(rest);
    case 'use': {
      // "use <item> on <target>"
      const onIdx = rest.toLowerCase().indexOf(' on ');
      if (onIdx !== -1) {
        const itm = rest.slice(0, onIdx).trim();
        const tgt = rest.slice(onIdx + 4).trim();
        return cmdUse(itm, tgt);
      }
      return cmdUse(rest);
    }
    case 'save':
      return cmdSave();
    case 'load':
      return cmdLoad();
    case 'help': case '?':
      return cmdHelp();
    case 'quit': case 'q': case 'exit':
      console.log(cy('またいつか。'));
      process.exit(0);
      break;
    default:
      console.log(ye(`「${raw}」は分かりません。help でコマンド一覧が見られます。`));
  }
}

// ─── Readline helpers ─────────────────────────────────────────────────────────
let rl;

function askQuestion(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });

  await showTitle();
  printRoom();

  rl.on('line', (line) => {
    parseCommand(line);
    process.stdout.write('\n' + g('> '));
  });

  rl.on('close', () => {
    console.log('\n' + cy('接続が切断されました。'));
    process.exit(0);
  });

  process.stdout.write('\n' + g('> '));
}

main().catch(console.error);
