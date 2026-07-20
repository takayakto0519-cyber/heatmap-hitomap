# カレンダー番人（calendar_watch.py）セットアップ — 会長の手動作業

このフォルダは `.gitignore` 済みです（中身がGitに載ることはありません）。

**手動作業を大幅に減らしました。** 元は「プロジェクト作成→API有効化→OAuth同意画面設定→
クライアントID作成」の一連をコンソールで一から辿る必要がありましたが、既存の
Google Cloudプロジェクト `hitomap-bot`（n8n連携で既に使われているもの）を再利用し、
以下は**私（Claude）が既に完了・準備済み**です：

- ✅ プロジェクト作成 → 既存の `hitomap-bot` を再利用（新規作成不要）
- ✅ Google Calendar API の有効化 → `gcloud` コマンドで完了済み
- ✅ OAuth同意画面（「対象」） → 既に「テスト中・外部」で設定済み（n8nのGmail連携のため既存）
- ✅ テストユーザー追加フォーム → メールアドレス入力済み、**「保存」ボタンを押すだけ**の状態でChromeに開いてあります
- ✅ OAuthクライアントID作成フォーム → 種類「デスクトップ アプリ」・名前入力済み、**「作成」ボタンを押すだけ**の状態でChromeに開いてあります

残る会長の手動作業は、以下の**3ステップだけ**です（所要2分程度）。

## 手順

1. **Chromeで開いている2つのタブを確認**
   - 1つ目：「ユーザーを追加」ダイアログ（`hitomap.info@gmail.com` 入力済み）→ **「保存」をクリック**
   - 2つ目：「OAuth クライアント ID の作成」フォーム（デスクトップ アプリ／calendar_watch）→ **「作成」をクリック**
   - もしタブが閉じてしまっていたら、Google Cloud Consoleで
     `https://console.cloud.google.com/auth/audience?project=hitomap-bot`（テストユーザー追加）と
     `https://console.cloud.google.com/auth/clients/create?project=hitomap-bot`（クライアント作成、種類はデスクトップ アプリを選択）
     を開き直してください。

2. **「作成」後に出るダイアログで「JSONをダウンロード」をクリック**
   ダウンロードしたファイル名を次のように変更して、このフォルダに置いてください：

   ```
   agents/secrets/calendar_client_secret.json
   ```

3. **初回認証を1回だけ実行**（ここでブラウザが開き、ログイン→「許可」をクリックする画面が出ます）

   PowerShellで：
   ```powershell
   cd "agents"
   python calendar_watch.py
   ```

   ブラウザが自動で開くので、`hitomap.info@gmail.com` でログインし（テストユーザー登録済みなので進めます）、
   「このアプリはGoogleで確認されていません」という警告が出たら
   「詳細」→「calendar_watch（秘書AI カレンダー連携）に移動」→ **「許可」をクリック**してください。

   成功すると `agents/secrets/calendar_token.json` が自動生成され、
   `agents/work/calendar_watch.json` に今日・明日の予定が書き出されます。
   **これ以降は無人で自動更新される**ので、手動作業はこの1回（＝上記3ステップ）だけです。

4. **完了したら教えてください**
   タスクスケジューラへの登録（毎朝6:50の自動実行）は、この後に私が行います。

## 何が読めて、何ができないか

- スコープは `calendar.readonly`（読み取り専用）のみ。
- このスクリプトは予定の作成・変更・削除を一切行いません（秘書スキル・ダッシュボードに
  「今日の予定」を渡すだけ）。
- `calendar_client_secret.json` と `calendar_token.json` は `.gitignore` 済みで、
  Gitに絶対にコミットされません。
- `hitomap-bot` プロジェクトの既存のn8n連携（Gmail用OAuthクライアント・サービスアカウント）には
  一切手を加えていません。今回追加したのは Calendar API の有効化と、新しい専用のOAuthクライアント
  （calendar_watch用）だけです。

---

# Gmail番人（gmail_watch.py）セットアップ — 会長の手動作業

自治体プロファイル（運営ダッシュボードの「関係人口」タブ）の営業メールについて、
送信済みか・返信が来ているかを自動確認するための連携です。calendar_watch.py と同じ
`hitomap-bot` プロジェクトを再利用します（Gmail APIは既に有効化済み）。

以下は**私（Claude）が既に完了・準備済み**です：

- ✅ Gmail API の有効化 → `gcloud` コマンドで確認・有効化済み（既にn8n連携で有効だった）
- ✅ OAuth同意画面（「対象」） → 既に「テスト中・外部」・テストユーザー`hitomap.info@gmail.com`登録済み（calendar_watch用に設定済みのものをそのまま利用）
- ✅ OAuthクライアントID作成フォーム → 種類「デスクトップ アプリ」・名前「gmail_watch（秘書AI Gmail連携）」入力済み、**「作成」ボタンを押すだけ**の状態でChromeに開いてあります

残る会長の手動作業は、以下の**2ステップだけ**です（所要2分程度）。

## 手順

1. **Chromeで開いているタブを確認**
   「OAuth クライアント ID の作成」フォーム（デスクトップ アプリ／gmail_watch）→ **「作成」をクリック**
   もしタブが閉じてしまっていたら、
   `https://console.cloud.google.com/auth/clients/create?project=hitomap-bot`
   を開き直し、種類「デスクトップ アプリ」を選んでください。

   「作成」後に出るダイアログで**「JSONをダウンロード」をクリック**し、ダウンロードしたファイル名を
   次のように変更してこのフォルダに置いてください：

   ```
   agents/secrets/gmail_client_secret.json
   ```

2. **初回認証を1回だけ実行**（ここでブラウザが開き、ログイン→「許可」をクリックする画面が出ます）

   PowerShellで：
   ```powershell
   cd "agents"
   python gmail_watch.py
   ```

   ブラウザが自動で開くので、`hitomap.info@gmail.com` でログインし、
   「このアプリはGoogleで確認されていません」という警告が出たら
   「詳細」→「gmail_watch（秘書AI Gmail連携）に移動」→ **「許可」をクリック**してください。

   成功すると `agents/secrets/gmail_token.json` が自動生成され、`municipality_profiles`の
   `contact_email`が入っている自治体について、送信済み・返信の有無がSupabaseに反映されます。
   **これ以降は無人で自動更新される**ので、手動作業はこの1回（＝上記2ステップ）だけです。

3. **完了したら教えてください**
   タスクスケジューラへの登録（定期実行）は、この後に私が行います。

## 何が読めて、何ができないか

- スコープは `gmail.readonly`（読み取り専用）のみ。
- このスクリプトはメールの送信・削除・ラベル変更を一切行いません（送信は必ず会長が
  運営ダッシュボードの「メール文案」からご自身のメールソフト・Gmailで行ってください）。
- `gmail_client_secret.json` と `gmail_token.json` は `.gitignore` 済みで、Gitに絶対に
  コミットされません。
- 対象は `municipality_profiles` のうち `contact_email` が入力されている行だけです。
  宛先メールアドレスが未入力の自治体は対象外（ダッシュボードで入力すると次回から対象になります）。
