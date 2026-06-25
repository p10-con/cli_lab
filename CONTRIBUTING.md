# Contributing to cli_lab

## コンセプト

このリポジトリは「CLIで遊ぶ共有の遊び場」です。各自が自由にCLIツールを作って、PRを出せます。ゆるく、でも最低限のルールを守って、みんなが気持ちよく使えるようにしましょう。

---

## ディレクトリ規約

```
commands/
└── {ユニークな識別子}/     ← 必ずこの階層を挟む（詳細は下記）
    └── {ツール名}/
        ├── README.md       ← 必須
        └── （ソースファイル等）
```

### ⚠️ 必須ルール：識別子ディレクトリを必ず挟むこと

`commands/` や `pages/` の直下にツールやファイルを置いてはいけません。
**必ず自分の識別子ディレクトリを一段挟んでください。**

```
# NG ❌
commands/hello/main.py
pages/index.html

# OK ✅
commands/alice/hello/main.py
pages/alice/portfolio/index.html
```

識別子は **他の参加者と被らない文字列** であれば何でも構いません。
GitHub ユーザー名がそのまま使えて確実です。

- 言語・フレームワークは自由（Node.js, Python, Go, Rust, シェルスクリプト…なんでも）
- 依存パッケージは自分のディレクトリ内で管理（`package.json` や `requirements.txt` など）

---

## README.md（各ツール必須）

以下を必ず含めてください：

```md
# ツール名

## 概要
何をするツールか、1〜2行で。

## 使い方
\`\`\`
コマンド例
\`\`\`

## 実行例（出力例）
\`\`\`
実際の出力
\`\`\`

## 依存・実行方法
インストール方法や実行コマンドなど。
```

---

## パッケージ管理

依存パッケージは**必ず自分のツールディレクトリ内で管理**してください。ルートに `package.json` や `requirements.txt` を置かないこと。

### Python

```bash
# venv を作成（ディレクトリ名は .venv 推奨）
python -m venv .venv

# 有効化
source .venv/bin/activate        # Mac / Linux
.venv\Scripts\activate           # Windows

# 依存をインストール
pip install -r requirements.txt

# 依存を追加したとき
pip freeze > requirements.txt
```

`uv` を使うとより高速で手軽です：

```bash
uv run main.py                   # venv を自動で作って実行
uv add requests                  # 依存追加（pyproject.toml に記録）
```

`.venv/` はコミットしないでください（`.gitignore` 済み）。

### Node.js

```bash
npm install                      # node_modules を作成
npm run start                    # 実行
```

`node_modules/` はコミットしないでください（`.gitignore` 済み）。`package-lock.json` はコミットしてOKです。

### Go

```bash
go mod init github.com/{username}/{tool}
go mod tidy                      # 依存を整理
go run main.go
```

`go.mod` / `go.sum` はコミットしてください。

### Rust

```bash
cargo run
cargo build --release            # リリースビルド
```

`Cargo.lock` はコミットしてください。`target/` はコミットしないでください（`.gitignore` 済み）。

### 外部APIキーが必要な場合

```bash
# .env を作る（コミットしない）
echo "API_KEY=xxxxx" > .env

# .env.example をコミット（キーの値は空にする）
echo "API_KEY=" > .env.example
```

`.env` は `.gitignore` 済みですが、念のため `git status` で確認してからコミットしてください。

---

## PRの出し方

1. `commands/{username}/{tool-name}/` を作成
2. `README.md` を書く
3. PRを開く — タイトルに `[username] ツール名` を含める
4. **1人以上のメンバーのApprove** でマージ可

---

## 安全・品質ルール

### やってはいけないこと ❌

| 禁止事項 | 理由 |
|----------|------|
| 自分のディレクトリ以外のファイルを変更 | 他の人の作業を壊す |
| シークレット・APIキーをハードコード | 漏洩リスク |
| ユーザーに無断でネットワークリクエスト | プライバシー・セキュリティ |
| `rm -rf` などの破壊的操作を無警告で実行 | データ消失リスク |

### 守ってほしいこと ✅

- 外部APIを叩く場合は README.md に明記する
- `.env` ファイルは `.gitignore` に追加し、`.env.example` を代わりにコミット
- ファイル削除・システムコマンド実行をする場合は、実行前にユーザーに確認を求める実装にする
- 新しいパッケージを追加する前に、本当に必要か検討する

---

## レビューのポイント

レビュアーは以下を確認します：

- [ ] README.md がある
- [ ] 他のディレクトリを変更していない
- [ ] 秘密情報がコードに含まれていない
- [ ] 危険な操作が無警告で実行されない
- [ ] ツールが説明通りに動く（軽く試す）

---

## 名前・ライセンス

- ツール名の衝突は username で回避しているので、ツール名自体は自由です
- このリポジトリ全体は **MIT License** です。追加するコードも同様に扱われます

---

## 困ったら

Issueを立てるか、Discordで相談してください。気軽にどうぞ！
