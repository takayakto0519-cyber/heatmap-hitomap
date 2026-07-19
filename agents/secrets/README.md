# カレンダー番人（calendar_watch.py）セットアップ — 会長の手動作業

このフォルダは `.gitignore` 済みです（中身がGitに載ることはありません）。
コード側の準備はすべて終わっています。残るのは以下の**会長の手動操作のみ**です。
所要時間はだいたい5分です。

## 手順

1. **Google Cloud Console を開く**
   https://console.cloud.google.com/ に `hitomap.info@gmail.com` でログイン。

2. **プロジェクトを作る**（既に何かプロジェクトがあればそれでも可）
   右上のプロジェクト選択 →「新しいプロジェクト」→ 名前は「ヒトマップ運営」などなんでもOK →作成。

3. **Google Calendar API を有効化**
   左メニュー「APIとサービス」→「ライブラリ」→ 検索欄に `Google Calendar API` と入力 → 開く →「有効にする」。

4. **OAuth同意画面を設定**
   「APIとサービス」→「OAuth同意画面」。
   - User Type: **外部（External）** を選択
   - アプリ名: 「ヒトマップ秘書」など任意
   - サポートメール／デベロッパーの連絡先: `hitomap.info@gmail.com`
   - スコープの追加は不要（あとで認証時に自動で読み取り専用スコープを要求します）
   - テストユーザーに `hitomap.info@gmail.com` を追加
   - 保存して完了（審査は不要。テストユーザーとして自分だけ使う分には公開審査に出さなくてOK）

5. **OAuthクライアントIDを作成**
   「APIとサービス」→「認証情報」→「+ 認証情報を作成」→「OAuth クライアント ID」。
   - アプリケーションの種類: **デスクトップアプリ**
   - 名前: 「calendar_watch」など任意
   - 作成 →「JSONをダウンロード」をクリック

6. **ダウンロードしたJSONをここに置く**
   ダウンロードしたファイル名を次のように変更して、このフォルダに置いてください：

   ```
   agents/secrets/calendar_client_secret.json
   ```

7. **初回認証を1回だけ実行**（ここでブラウザが開き、ログイン→「許可」をクリックする画面が出ます）

   PowerShellで：
   ```powershell
   cd "agents"
   python calendar_watch.py
   ```

   ブラウザが自動で開くので、`hitomap.info@gmail.com` でログインし、
   「このアプリはGoogleで確認されていません」という警告が出た場合は
   「詳細」→「（アプリ名）に移動」→ **「許可」をクリック**してください
   （テストユーザー登録した自分のアカウントなので安全です）。

   成功すると `agents/secrets/calendar_token.json` が自動生成され、
   `agents/work/calendar_watch.json` に今日・明日の予定が書き出されます。
   **これ以降は無人で自動更新される**ので、手動作業はこの1回だけです。

8. **完了したら教えてください**
   タスクスケジューラへの登録（毎朝の自動実行）は、この後に私が行います。

## 何が読めて、何ができないか

- スコープは `calendar.readonly`（読み取り専用）のみ。
- このスクリプトは予定の作成・変更・削除を一切行いません（秘書スキル・ダッシュボードに
  「今日の予定」を渡すだけ）。
- `calendar_client_secret.json` と `calendar_token.json` は `.gitignore` 済みで、
  Gitに絶対にコミットされません。
