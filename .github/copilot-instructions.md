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

- **自分の名前空間にだけ置く** — `commands/{username}/` または `pages/{username}/`
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
