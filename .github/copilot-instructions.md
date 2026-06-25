# GitHub Copilot Instructions

このリポジトリは複数人が自由に CLI ツールや静的 Web ページを作れる共有の遊び場です。
詳細は [CLAUDE.md](../CLAUDE.md) と [CONTRIBUTING.md](../CONTRIBUTING.md) を参照してください。

## ディレクトリ構成

```
commands/{username}/{tool}/   # CLI ツール（言語自由）
pages/{username}/{site}/      # 静的 Web サイト
lab.py                        # CLI ディスパッチャー（変更不要）
```

## コードを生成するときの注意

- **識別子ディレクトリを必ず挟む** — `commands/` や `pages/` の直下にファイルを置いてはいけない。必ず `commands/{識別子}/{ツール名}/` の形にする。識別子は他の参加者と被らない文字列（GitHub ユーザー名推奨）
- 各ツールには `tool.json`（起動設定）と `README.md`（説明）が必須
- 依存パッケージはツールディレクトリ内で管理する（ルートに `package.json` 等を置かない）
- シークレット・APIキーはコードにハードコードしない（`.env` を使う）
- `lab.py` やルートの設定ファイルは原則変更しない

## tool.json の形式

```json
{
  "description": "一行説明",
  "run": "python main.py",
  "install": "pip install -r requirements.txt"
}
```
