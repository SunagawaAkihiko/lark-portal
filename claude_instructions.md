# Claude Code 修正指示書：カレンダー予定登録の手元テスト（ローカル）での動作保証

## 1. 背景・現状の課題
`attendance-app/server.js` のLark API連携のバグ修正はローカルで完了しています。
しかし、現在 `calendar.js` (フロントエンド) の向いているAPI先が**本番環境のRender (`https://attendance-app-irf1.onrender.com`) のまま**になっています。
その結果、ローカルで修正した `server.js` が使われず、デプロイされていない古いクラウド上のバグだらけのサーバーにアクセスしてしまい、登録エラーが再発しています。

## 2. 修正の指示内容

Claude Codeは、`lark-portal/calendar.js` の1行目にある `API_BASE` 変数を以下のように「環境に応じてローカルホストとRenderを自動で切り替える」ようにスマートに修正してください。

### `calendar.js` の修正

**【修正前】**
```javascript
const API_BASE = "https://attendance-app-irf1.onrender.com"; // 本番環境
```

**【修正後（自動判定にする）】**
```javascript
// URLがローカル(localhost, 127.0.0.1) または ファイルプロトコル(file://) の場合はローカルのNodeサーバーを参照する
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.protocol === 'file:';

const API_BASE = isLocal 
    ? "http://localhost:3000" 
    : "https://attendance-app-irf1.onrender.com";
```

### 追加の確認事項
フロントエンドのローカルテストを行う場合、必ず手元のターミナルで `attendance-app` 内に移動し、
`npm start`（または `node server.js`）を実行してローカルのサーバー（ポート3000）を起動するようにユーザーにお伝えしてください。

## 3. 次のアクション
上記の通り `calendar.js` のAPI向先を修正し、手元のローカル内で「フロントエンド」と「修正済みのローカルNodeサーバー」が正しく繋がるように設定を完了させてください。
その後、手元で予定登録のテストを行うようユーザーに依頼してください。
