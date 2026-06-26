# gris/todo

GitHub の `data` ブランチに保存して管理する、シンプルな Todo CLI。

データは `p10-con/cli_lab` リポジトリの `data` ブランチの `gris/todos.json` に置かれます。

---

## セットアップ

### 1. GitHub Personal Access Token を取得する

[GitHub Settings → Tokens (classic)](https://github.com/settings/tokens) で
`repo` スコープを持つトークンを生成してください。

### 2. トークンを設定する

**方法 A：環境変数**

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

**方法 B：.env ファイル（このディレクトリに作成）**

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

> `.env` は `.gitignore` に追加してコミットしないようにしてください。

---

## 使い方

```bash
# タスクを追加する
node index.js add "買い物をする"

# 一覧を表示する
node index.js list

# タスクを完了にする（ID を指定）
node index.js done 1

# タスクを削除する（ID を指定）
node index.js remove 1

# ヘルプを表示する
node index.js help
```

lab.py 経由で呼ぶ場合：

```bash
python lab.py gris todo list
python lab.py gris todo add "新しいタスク"
python lab.py gris todo done 1
python lab.py gris todo remove 2
```

---

## 実行例

```
ℹ 読み込み中...
─── Todo リスト ────────────────────────────
  ○ [ 1] 買い物をする (2026-06-26)
  ✓ [ 2] 掃除をする (2026-06-25)
  ○ [ 3] 本を読む (2026-06-26)
────────────────────────────────────────────
  合計: 3 件  未完了: 2  完了: 1
```

---

## データ形式

```json
{
  "todos": [
    { "id": 1, "text": "タスク", "done": false, "created": "2026-06-26" }
  ]
}
```

---

## 依存

Node.js 18 以上（ES modules、標準ライブラリのみ）
