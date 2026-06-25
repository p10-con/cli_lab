# AGENTS.md

AI エージェント向けのリポジトリ概要です。
詳細は [CLAUDE.md](./CLAUDE.md) と [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## このリポジトリは何か

複数のコントリビューターが CLI ツールや静的 Web ページを自由に作れる共有の遊び場です。

## ディレクトリ構成

```
lab.py                          # CLIディスパッチャー（触らない）
commands/{username}/{tool}/     # CLI ツール
  ├── tool.json                 # 起動設定（必須）
  └── README.md                 # 説明（必須）
pages/{username}/{site}/        # 静的 Web サイト
```

## コードを追加・変更するときのルール

1. **`commands/` や `pages/` の直下にファイルを置かない** — 必ず `commands/{識別子}/{ツール名}/` の形で識別子ディレクトリを挟む。識別子は他の参加者と被らない文字列（GitHub ユーザー名推奨）
2. 作業は自分の識別子ディレクトリ内だけに限定する
3. ルートや他の識別子のディレクトリは変更しない
3. 依存パッケージはツールディレクトリ内で完結させる
4. API キー等はコードに書かず `.env` に入れる（`.env` はコミットしない）
5. `lab.py` は変更しない

## tool.json のスキーマ

```json
{
  "description": "string（任意）— --list に表示される説明",
  "run": "string（必須）— 実行コマンド",
  "install": "string（任意）— 初回のみ実行されるセットアップコマンド"
}
```

## CLIの実行方法

```bash
python lab.py {username} {tool} [args...]
python lab.py --list
```
