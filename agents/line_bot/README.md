# LINE縁ミッション連携

75人のLINEグループを「縁を設計する装置」にする仕組み。2つの部品でできている。

## 部品
- `line_mission.py`（agents/直下）— 2週に一度、名簿から2人を選んで「この人と話してみて」の縁ミッションを作る。**既定は下書きモード**：`06_実行待機_Approval` に置き、会長が送る。
- `line_bot/webhook.py` — グループの出来事（新メンバー参加・自己紹介の投稿）を受け取り、会長にDiscordで知らせる。**既定は検知して伝えるだけ**（自動返信しない）。
- `line_bot/config.json` — 名簿・間隔・自動化スイッチ。**ダッシュボードの「⚙データ編集」→「LINE縁ミッション設定」から編集できる。**

## なぜ「既定は下書き・通知だけ」なのか
憲法（AIが先に実行して報告する外部行動の禁止）と安全の原則により、75人への自動投稿は既定でオフ。会長が中身を確認して送る。
自分の判断で自動投稿してよいと決めたら、`config.json` の `auto_push` / `auto_welcome` を `true` にする（＝会長の明示的な承認）。

## 動かすのに必要なもの（会長の作業）
今の「動いていない」状態から動かすには、次の3つが要る:

1. **チャネルアクセストークンとシークレット**を `.env.local` に追記:
   ```
   LINE_CHANNEL_TOKEN=（LINE Developersのチャネルアクセストークン）
   LINE_CHANNEL_SECRET=（チャネルシークレット）
   ```
2. **グループID** を `config.json` の `group_id` に設定（botをグループに入れて、最初のイベントの `source.groupId` から取得。webhookのevents_log.jsonlに出る）。
3. **公開URL** を LINE Developers コンソールの Webhook URL に設定。webhook.py はローカル :8790 で待つので、外から届くようにする。

   **このPCには ngrok が既にインストール・認証済み**（2026-07-18確認、`ngrok diagnose`で接続成功）。cloudflare tunnelより手軽なのでこちらを使う：
   ```
   python agents/line_bot/webhook.py   （別ターミナルで起動したまま）
   ngrok http 8790                     （もう一つ別ターミナルで起動）
   ```
   ngrokが表示する `https://xxxx.ngrok-free.app`（またはyour static domain）をコピーし、
   LINE Developers コンソールの Messaging API設定 → Webhook URL に `https://xxxx.ngrok-free.app` を貼って「検証」を押す。
   ngrokの無料プランはURLが再起動のたびに変わるので、`ngrok http 8790` は一度設定した後は極力落とさない（PC再起動時は再設定が要る）。

※ グループ全員のIDを一覧取得するAPIは認証済みアカウント限定のため、**名簿(members)は会長が config.json に手入力**する運用（新規参加はwebhookが検知して知らせるので、その都度足す）。

## 動作テスト（トークン無しでも今すぐできる範囲）
- `python agents/line_mission.py` → 名簿が2人以上なら、縁ミッション下書きが `06_実行待機_Approval/LINE縁ミッション_YYYYMMDD.md` に出る。
- webhook本体の疎通: `python agents/line_bot/webhook.py` を起動し、ブラウザで http://127.0.0.1:8790 を開くと "alive" が出る。
