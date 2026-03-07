# Consor — Todo App

やることを、ひとつずつ。シンプルなタスク管理アプリです。

## 機能

- タスクの追加・完了・削除
- フィルター（すべて / 未完了 / 完了）
- 完了済みを一括削除
- ローカルストレージで保存（ブラウザを閉じても残ります）

## 使い方

1. `index.html` をブラウザで開く
2. またはローカルサーバーで表示（例: `npx serve .`）

## ファイル構成

```
todo-app/
├── index.html
├── style.css
├── app.js
└── README.md
```

## GitHub リポジトリへプッシュする場合

```bash
cd todo-app
git init
git add .
git commit -m "Initial commit: Consor todo app"
git remote add origin https://github.com/tsukky101/Consor.git
git branch -M main
git push -u origin main
```

GitHub Pages で公開する場合は、リポジトリの Settings → Pages でソースを `main` ブランチに設定してください。
