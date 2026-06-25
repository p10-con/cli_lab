# parallel-fetch

複数の URL を `Promise.all` で同時にリクエストし、ステータスコードとレスポンスタイムを表示する。
逐次実行との時間差でNode.js の非同期並列処理の恩恵が体感できる。

## 使い方

```bash
python lab.py gris parallel-fetch <url1> <url2> ...
```

## 実行例

```
3 件を並列リクエスト中...

  200    312ms  https://example.com
  200    489ms  https://github.com
  404    201ms  https://httpbin.org/status/404

合計: 512ms（逐次なら最低 1002ms かかっていた）
```

## 依存

なし（Node.js 18+ の組み込み `fetch` を使用）。
