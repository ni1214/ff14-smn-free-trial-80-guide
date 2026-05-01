# 自宅PCで続きを始める手順

このファイルは、自宅のPCやGitHub Desktopで同じ開発を続けるための手順書です。

## 1. GitHub Desktopで同期する

1. GitHub Desktopを開く。
2. `File` -> `Clone repository...` を選ぶ。
3. `URL` タブに下記を入れる。

```text
https://github.com/ni1214/ff14-smn-free-trial-80-guide.git
```

4. 保存先フォルダを選んで `Clone` する。
5. ブランチが `main` になっていることを確認する。
6. 右上の `Fetch origin` または `Pull origin` で最新化する。

## 2. ローカルで開いて確認する

このサイトは静的サイトなので、基本は `index.html` をブラウザで開くだけでも確認できます。

より確実に確認する場合は、リポジトリのフォルダでPowerShellを開いてください。

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

ブラウザで開くURL:

```text
http://127.0.0.1:4173/
```

## 3. 変更後に公開する

このリポジトリでは、`main` ブランチへpushするとGitHub Pagesが自動で公開します。

PowerShellで公開する場合:

```powershell
.\tools\publish.ps1 -Message "変更内容を短く書く"
```

GitHub Desktopで公開する場合:

1. 変更内容を確認する。
2. 左下のSummaryにコミットメッセージを書く。
3. `Commit to main` を押す。
4. `Push origin` を押す。
5. 30秒から1分ほど待って公開URLを確認する。

公開URL:

```text
https://ni1214.github.io/ff14-smn-free-trial-80-guide/
```

## 4. CodexやAIに頼む時の最初の一言

自宅PCでAIに続きを頼む時は、最初にこう伝えると今までの方針に合わせやすいです。

```text
AGENTS.md と DEVELOPMENT.md を読んで、このFF14攻略アプリの既存方針に合わせて作業してください。変更後は検証して、mainへコミット・pushしてGitHub Pages公開まで行ってください。
```

## 5. このプロジェクトの大事な前提

- スマホ縦画面専用に近い設計。
- 二人用だがログインや共有DBは使わない。
- 保存は端末ごとのlocalStorage。
- 外部リンクは日本語ページ。
- スキルとアイコンは公式ジョブガイド準拠。
- 装備とアイコンはできるだけ公式DB名に合わせる。
- 初心者が迷わないよう、最初に見る項目を絞る。

