-- municipality_profiles に「実際にGmailで送信したメール本文」を追加する。
-- 既存のemail_draftは下書き（送信前に編集される可能性がある）、
-- email_sent_contentはgmail_watch.pyがGmail送信済みメールから実際に取得した本文。
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS email_sent_content text;
