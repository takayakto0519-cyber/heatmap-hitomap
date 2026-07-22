-- 宛先メールディープリサーチの結果（確度・出典）を保存する列を追加する。
-- これまでemail/contact_emailはあっても「どこまで確からしいか」「どのページで見つけたか」を
-- 保存する場所が無く、⚠要確認の注記が下書き本文に埋め込まれるだけだった。
-- 送信キュー（会長の1クリック承認）が確度をもとに送信ボタンの有効/無効を判定するために必要。
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS contact_email_confidence text; -- 'high'|'medium'|'low'
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS contact_email_source_url text;

-- client_leads・sales_email_targetsには下書き本文を保存する列が無く、06_実行待機_Approval配下の
-- ローカルMarkdownにしか存在しなかった（gitignore対象＝本番Vercelサーバーからは読めない）。
-- 送信キューが本番で下書きを送るには、municipality_profiles.email_draftと同じ形でDBに置く必要がある。
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS email_draft text; -- 1行目を件名として扱う（municipality_profilesと同じ規約）

ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS contact_email_confidence text;
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS contact_email_source_url text;
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS email_draft text;

ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS contact_email_confidence text;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS contact_email_source_url text;
