# cli_lab

CLIツールを自由に作って遊べる共有リポジトリです。
言語もフレームワークも自由。思いついたものをなんでも作ってPRを出してください。

## はじめかた

```bash
git clone https://github.com/p10-con/cli_lab.git
cd cli_lab
```

あとは `commands/{あなたのGitHubユーザー名}/` に好きなツールを作るだけ。

```
commands/
└── alice/
│   └── hello-world/
│       ├── README.md
│       └── index.js
└── bob/
    └── dice-roller/
        ├── README.md
        └── main.py
```

## ルール

詳しくは [CONTRIBUTING.md](./CONTRIBUTING.md) を読んでください。要点だけ：

- 自分の名前空間（`commands/{username}/`）の中だけで自由に作る
- 各ツールに `README.md` を書く（使い方・動作例）
- PRには1人以上のApproveが必要
- 秘密情報をコードに書かない

## ライセンス

MIT
