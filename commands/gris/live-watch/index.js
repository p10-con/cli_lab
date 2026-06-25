import fs from 'fs';
import path from 'path';

const dim    = s => `\x1b[2m${s}\x1b[0m`;
const green  = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const bold   = s => `\x1b[1m${s}\x1b[0m`;

const target = process.argv[2] ?? '.';
const abs    = path.resolve(target);

if (!fs.existsSync(abs)) {
  console.error(red(`エラー: ${abs} が見つかりません`));
  process.exit(1);
}

const label = { rename: yellow('renamed/created'), change: green('changed') };
const icon  = { rename: yellow('~'), change: green('✎') };

console.log(bold(`Watching: ${abs}`));
console.log(dim('Ctrl+C で終了\n'));

fs.watch(abs, { recursive: true }, (event, filename) => {
  if (!filename) return;
  const time = new Date().toLocaleTimeString('ja-JP');
  console.log(`${dim(time)}  ${icon[event] ?? red('?')}  ${filename}  ${dim(label[event] ?? event)}`);
});
