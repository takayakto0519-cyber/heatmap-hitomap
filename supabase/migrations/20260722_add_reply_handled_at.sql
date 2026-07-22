-- 返信あり専用導線：client_leads / sales_email_targets / municipality_profiles の
-- どれかにemail_replyが入っていて、まだ会長が「見た・対応した」を押していないものを
-- 横断で1つのキューとして表示するための「対応済みマーカー」を追加する。
-- これまでは返信が来てもDiscord通知が流れるだけで、ダッシュボード上に
-- 「返信が来た案件だけ」を集めて確認する場所が無かった。
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS reply_handled_at timestamptz;
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS reply_handled_at timestamptz;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS reply_handled_at timestamptz;
