# live-watch

ディレクトリをリアルタイム監視して、ファイルの変更・追加・削除を表示する。
Node.js の `fs.watch` とイベント駆動モデルを使用。

## 使い方

```bash
python lab.py gris live-watch              # カレントディレクトリを監視
python lab.py gris live-watch ./src        # 対象ディレクトリを指定
```

## 実行例

```
Watching: /path/to/dir
Ctrl+C で終了

12:34:56  ✎  app.js         changed
12:34:58  ~  newfile.txt    renamed/created
```

## 依存

なし（Node.js 標準ライブラリのみ）。Node.js 14.5+ 推奨（`recursive` オプション使用）。
