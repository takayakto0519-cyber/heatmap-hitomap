-- client_leads と sales_email_targets の重複統合（P0-1）。
-- 調査の結果、sales_email_targets 8件全て（100%）が client_leads に同一組織名で重複登録されており、
-- メール下書き・宛先確度が片方にしか無いために送信キューから見えなくなる事故が過去に発生した。
-- client_leads をマスターとし、sales_email_targets 固有列（hook/drafted/sent）を統合する。
-- sales_email_targets テーブル自体は当面削除しない（バックフィル後、コード側の参照を外すのみ）。
--
-- ※ 20260720_add_lead_outreach_fields.sql が本番未適用だったことも判明したため、
--   ここに含めて一度に適用する（IF NOT EXISTSなので既に適用済みでも安全）。

-- 送信後ライフサイクル（積み残し分）
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS email_reply text;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS followed_up_at timestamptz;

-- sales_email_targets固有列の統合
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS hook text;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS drafted boolean DEFAULT false;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS sent boolean DEFAULT false;
