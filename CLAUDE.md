# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) 向けのガイダンスです。

## このリポジトリについて

複数のコントリビューターが自由に CLI ツールや Web ページを作って PR を出せる共有の遊び場です。

## ディレクトリ構成

```
cli_lab/
├── lab.py                      # ディスパッチャー（CLIツールの起動口）
├── commands/
│   └── {username}/{tool}/      # CLI ツール
│       ├── tool.json           # 起動設定（必須）
│       ├── README.md           # 説明・使い方（必須）
│       └── ...ソースファイル
├── pages/
│   └── {username}/{site}/      # GitHub Pages 用の静的サイト
│       └── ...HTML/CSS/JS等
├── CONTRIBUTING.md
└── README.md
```

## ディスパッチャーの使い方

```bash
python lab.py <username> <tool> [args...]   # ツールを実行
python lab.py --list                        # 一覧表示
```

例：
```bash
python lab.py example hello
python lab.py example hello Claude
```

## tool.json の書き方

```json
{
  "description": "ツールの一行説明",
  "run": "python main.py",
  "install": "pip install -r requirements.txt"
}
```

- `run`（必須）: 実行コマンド。`cwd` はツールのディレクトリになる
- `install`（任意）: 初回のみ自動実行されるセットアップコマンド
- `description`（任意）: `--list` に表示される説明

初回 `install` が成功すると `.installed` ファイルが生成され、2回目以降はスキップされる。

## 新しい CLI ツールの追加手順

1. `commands/{GitHubユーザー名}/{ツール名}/` を作成
2. `tool.json` を書く
3. `README.md` に概要・使い方・動作例を書く
4. ソースファイルを追加し、ローカルで動作確認
5. PR を開く（1人以上の Approve でマージ可）

## 新しい Pages サイトの追加手順

1. `pages/{GitHubユーザー名}/{サイト名}/` を作成
2. HTML / CSS / JS を置く
3. PR を開く

## 規約

- **識別子ディレクトリを必ず挟む（最重要）**：`commands/` や `pages/` の直下にファイルを置いてはいけない。必ず `commands/{識別子}/{ツール名}/` の形にする。識別子は他の参加者と被らない文字列（GitHub ユーザー名推奨）
- **依存は自分のディレクトリ内で管理**：`package.json`・`requirements.txt` 等はツールディレクトリに置く
- **`node_modules/`・`.venv/`・`dist/` はコミットしない**（`.gitignore` 済み）
- **他のコントリビューターのディレクトリを変更しない**

## 安全ルール

- 秘密情報（APIキー等）をコードにハードコードしない（`.env` を使い `.gitignore` に追加）
- 外部 API へのリクエストはツールの `README.md` に明記する
- ファイル削除・システムコマンド等の破壊的操作は実行前にユーザーへ確認を求める
