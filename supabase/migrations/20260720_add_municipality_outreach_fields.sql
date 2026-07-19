-- municipality_profiles に営業メール周りの項目を追加する。
-- contact_email: 判明している宛先（多くは未確定のため空欄運用）
-- email_draft: 初回接触メールの下書き（自動生成、会長が編集の上メールソフトから送信）
-- email_sent_at: 会長が「送信済みにする」を押した日時
-- email_reply: 届いた返信を貼り付けて残す自由記述欄
-- is_priority_pick: 営業価値が特に高い最優先自治体のフラグ（ダッシュボードで目立たせる）

ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS email_draft text;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS email_reply text;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS is_priority_pick boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_municipality_profiles_priority ON municipality_profiles (is_priority_pick);
