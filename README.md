# FF14 Summoner Free Trial Lv80 Guide

スマホ向けに見やすく整理した、FF14 召喚士のフリートライアルLv80ガイドです。

公開ページ:

- GitHub Pagesで配信

内容:

- Lv10 / 20 / 30 / 40 / 50 / 60 / 70 / 80ごとの回し
- 単体 / 3体以上AoEの切り替え
- 実際のスキルアイコン付き
- 出典リンク付き

## Firebase同期

ログイン画面は出さず、Firebase Anonymous Authenticationを裏側で使って進捗を同期します。
Firebaseに接続できない場合は、端末内のlocalStorageへ保存します。

Firebaseコンソールで必要な設定:

1. Authentication > Sign-in method > Anonymous を有効化
2. Authentication > Settings > Authorized domains にGitHub Pagesのドメインを追加
3. Firestore Database を作成
4. Firestore Rulesに以下を設定

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /ff14SummonerGuide/v1/profiles/{profileId} {
      allow read: if request.auth != null
        && profileId in ['me', 'senpai'];

      allow create, update: if request.auth != null
        && profileId in ['me', 'senpai']
        && request.resource.data.keys().hasOnly(['dailyGoal', 'checks', 'updatedAt'])
        && request.resource.data.dailyGoal is string
        && request.resource.data.dailyGoal.size() <= 60
        && request.resource.data.checks is map
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 参考にした設計

大手FF14サイトの強みを、二人用の小さいサイトでも使える形に落とし込んでいます。

- The Balance: ジョブ別に更新日つきの専門ガイドを置く
- Garland Tools: 迷った時に横断検索できる入口を作る
- FFXIV Teamcraft: 進捗・リスト・共有で「次にやること」を見える化する
- Universalis: 目的別のツール入口を用意する
- Eorzea Collection / FFXIV Collect: 攻略以外のワクワク、収集、見た目の導線を置く
