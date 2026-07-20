-- 送信後ライフサイクルの統一：client_leads と sales_email_targets に、
-- municipality_profiles と同じ「送信後」項目を追加する。
-- これで lib/followUp.ts の computeFollowUp() を全チャンネル（リード・自治体・営業メール）で
-- 共通に使えるようになり、「下書き→送信済み→要フォロー→返信あり」を1つの物差しで管理できる。
--
-- email_sent_at : 会長が「送信済み」を押した日時（これが無いとフォロー判定ができない）
-- email_reply   : 届いた返信を貼り付けて残す自由記述欄
-- followed_up_at: 電話・対面など手動フォローを記録した日時（ここから経過日数を数え直す）
--
-- ※ Supabase SQL Editor で一度実行してください（既存データは影響なし・IF NOT EXISTS で冪等）。

-- 学校・法人リード
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS email_reply text;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS followed_up_at timestamptz;

-- 営業メール送り先（従来は sent(bool) だけで日時が無く、要フォロー判定ができなかった）
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS email_reply text;
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS followed_up_at timestamptz;
