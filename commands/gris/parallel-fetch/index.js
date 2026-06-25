const urls = process.argv.slice(2);

const reset  = '\x1b[0m';
const green  = s => `\x1b[32m${s}${reset}`;
const red    = s => `\x1b[31m${s}${reset}`;
const yellow = s => `\x1b[33m${s}${reset}`;
const dim    = s => `\x1b[2m${s}${reset}`;
const bold   = s => `\x1b[1m${s}${reset}`;

if (urls.length === 0) {
  console.log(`使い方: python lab.py gris parallel-fetch <url1> <url2> ...`);
  console.log(`例:     python lab.py gris parallel-fetch https://example.com https://github.com`);
  process.exit(0);
}

const fetchOne = async (url) => {
  const start = Date.now();
  try {
    const res = await fetch(url);
    const ms  = Date.now() - start;
    return { url, status: res.status, ms, ok: res.ok };
  } catch (e) {
    const ms = Date.now() - start;
    return { url, error: e.message, ms, ok: false };
  }
};

console.log(bold(`\n${urls.length} 件を並列リクエスト中...\n`));

const start   = Date.now();
const results = await Promise.all(urls.map(fetchOne));
const total   = Date.now() - start;

const maxUrl = Math.max(...results.map(r => r.url.length));

for (const r of results) {
  const status = r.ok
    ? green(`${r.status}`)
    : r.error
      ? red('ERR')
      : yellow(`${r.status}`);

  const ms  = `${r.ms}ms`.padStart(7);
  const url = r.url.padEnd(maxUrl);
  const err = r.error ? `  ${dim(r.error)}` : '';

  console.log(`  ${status}  ${dim(ms)}  ${url}${err}`);
}

console.log(dim(`\n合計: ${total}ms（逐次なら最低 ${results.reduce((s, r) => s + r.ms, 0)}ms かかっていた）`));
