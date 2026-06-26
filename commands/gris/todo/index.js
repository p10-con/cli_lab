#!/usr/bin/env node
/**
 * gris/todo - GitHub data ブランチで管理する Todo CLI
 * 外部依存なし（Node.js 標準ライブラリのみ）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── ANSI カラー定数 ──────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
  gray:   '\x1b[90m',
};

const ok    = (msg) => console.log(`${C.green}✓${C.reset} ${msg}`);
const fail  = (msg) => console.error(`${C.red}✗${C.reset} ${msg}`);
const info  = (msg) => console.log(`${C.cyan}ℹ${C.reset} ${msg}`);
const hint  = (msg) => console.log(`${C.gray}${msg}${C.reset}`);

// ── 設定 ────────────────────────────────────────────────────────────────────
const REPO    = 'p10-con/cli_lab';
const BRANCH  = 'data';
const FILE    = 'gris/todos.json';
const API_URL = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

// ── .env 読み込み（dotenv 不使用） ───────────────────────────────────────────
function loadEnv() {
  const __dir = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.join(__dir, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val   = line.slice(eq + 1).trim();
    // 引用符を除去
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ── GitHub API ───────────────────────────────────────────────────────────────
function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    fail('GITHUB_TOKEN が設定されていません。');
    hint('  export GITHUB_TOKEN=ghp_xxxxxxxx  または  .env ファイルに記載してください。');
    process.exit(1);
  }
  return token;
}

async function fetchTodos() {
  const token = getToken();
  const res = await fetch(`${API_URL}?ref=${BRANCH}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept:        'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (res.status === 404) {
    // ファイルが存在しない → 空リストとして扱う
    return { todos: [], sha: null };
  }

  if (!res.ok) {
    const body = await res.text();
    fail(`GitHub API エラー (${res.status}): ${body}`);
    process.exit(1);
  }

  const json = await res.json();
  const content = Buffer.from(json.content, 'base64').toString('utf8');
  const data = JSON.parse(content);
  return { todos: data.todos ?? [], sha: json.sha };
}

async function saveTodos(todos, sha) {
  const token = getToken();
  const content = Buffer.from(
    JSON.stringify({ todos }, null, 2) + '\n'
  ).toString('base64');

  const body = {
    message: `chore: update todos [${new Date().toISOString()}]`,
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(API_URL, {
    method:  'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept:        'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    fail(`保存に失敗しました (${res.status}): ${text}`);
    process.exit(1);
  }
}

// ── 今日の日付 (YYYY-MM-DD) ─────────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── 次の ID ──────────────────────────────────────────────────────────────────
function nextId(todos) {
  return todos.length === 0 ? 1 : Math.max(...todos.map((t) => t.id)) + 1;
}

// ── サブコマンド ─────────────────────────────────────────────────────────────

async function cmdAdd(text) {
  if (!text || !text.trim()) {
    fail('タスクの内容を指定してください。');
    hint('  node index.js add "タスク内容"');
    process.exit(1);
  }

  info('読み込み中...');
  const { todos, sha } = await fetchTodos();

  const todo = {
    id:      nextId(todos),
    text:    text.trim(),
    done:    false,
    created: today(),
  };
  todos.push(todo);

  info('保存中...');
  await saveTodos(todos, sha);
  ok(`追加しました  ${C.bold}[${todo.id}]${C.reset} ${todo.text}`);
}

async function cmdList() {
  info('読み込み中...');
  const { todos } = await fetchTodos();

  if (todos.length === 0) {
    hint('Todo はまだありません。');
    return;
  }

  console.log('');
  console.log(`${C.bold}${C.cyan}─── Todo リスト ────────────────────────────${C.reset}`);
  for (const t of todos) {
    const id      = `${C.bold}[${String(t.id).padStart(2)}]${C.reset}`;
    const check   = t.done ? `${C.green}✓${C.reset}` : `${C.yellow}○${C.reset}`;
    const text    = t.done
      ? `${C.dim}${C.gray}${t.text}${C.reset}`
      : t.text;
    const created = `${C.gray}(${t.created})${C.reset}`;
    console.log(`  ${check} ${id} ${text} ${created}`);
  }
  console.log(`${C.cyan}────────────────────────────────────────────${C.reset}`);

  const done    = todos.filter((t) => t.done).length;
  const pending = todos.length - done;
  console.log(
    `  ${C.bold}合計:${C.reset} ${todos.length} 件  ` +
    `${C.yellow}未完了: ${pending}${C.reset}  ` +
    `${C.green}完了: ${done}${C.reset}`
  );
  console.log('');
}

async function cmdDone(idStr) {
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    fail(`ID が正しくありません: ${idStr}`);
    process.exit(1);
  }

  info('読み込み中...');
  const { todos, sha } = await fetchTodos();

  const todo = todos.find((t) => t.id === id);
  if (!todo) {
    fail(`ID ${id} の Todo が見つかりません。`);
    process.exit(1);
  }
  if (todo.done) {
    hint(`[${id}] "${todo.text}" はすでに完了済みです。`);
    return;
  }

  todo.done = true;

  info('保存中...');
  await saveTodos(todos, sha);
  ok(`完了にしました  ${C.bold}[${id}]${C.reset} ${C.dim}${todo.text}${C.reset}`);
}

async function cmdRemove(idStr) {
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    fail(`ID が正しくありません: ${idStr}`);
    process.exit(1);
  }

  info('読み込み中...');
  const { todos, sha } = await fetchTodos();

  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) {
    fail(`ID ${id} の Todo が見つかりません。`);
    process.exit(1);
  }

  const [removed] = todos.splice(idx, 1);

  info('保存中...');
  await saveTodos(todos, sha);
  ok(`削除しました  ${C.bold}[${id}]${C.reset} ${removed.text}`);
}

// ── ヘルプ ───────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`
${C.bold}${C.cyan}gris/todo${C.reset} — GitHub data ブランチで管理する Todo CLI

${C.bold}使い方:${C.reset}
  ${C.yellow}node index.js add${C.reset} <テキスト>   タスクを追加する
  ${C.yellow}node index.js list${C.reset}             一覧を表示する
  ${C.yellow}node index.js done${C.reset} <id>        タスクを完了にする
  ${C.yellow}node index.js remove${C.reset} <id>      タスクを削除する
  ${C.yellow}node index.js help${C.reset}             このヘルプを表示する

${C.bold}環境変数:${C.reset}
  ${C.green}GITHUB_TOKEN${C.reset}   GitHub Personal Access Token（repo スコープ）

${C.bold}データ:${C.reset}
  ${C.gray}https://github.com/${REPO}/blob/${BRANCH}/${FILE}${C.reset}
`);
}

// ── エントリポイント ─────────────────────────────────────────────────────────
loadEnv();

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'add':    await cmdAdd(args.join(' '));  break;
  case 'list':   await cmdList();               break;
  case 'done':   await cmdDone(args[0]);        break;
  case 'remove': await cmdRemove(args[0]);      break;
  case 'help':
  case '--help':
  case '-h':     printHelp();                   break;
  default:
    if (cmd) fail(`不明なコマンド: ${cmd}`);
    printHelp();
    if (cmd) process.exit(1);
}
