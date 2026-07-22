-- 商流一気通貫化：案件（business_cases）に商談金額・受注確度・請求/入金トラッキングを追加する。
-- これまで案件はステージ管理のみで金額を持たず、パイプライン総額・受注率・入金予定が
-- ダッシュボードから計算できなかった（入金照合はローカルMarkdownのgrep頼み）。
-- ※ ensure_schema() の再定義は行わない（過去にテーブル定義が抜け落ちる事故があったため、
--    近年のマイグレーションと同様に単体のALTER文のみとする）。

ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS amount integer;              -- 想定/受注金額（円）
ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS probability integer DEFAULT 50; -- 受注確度%（0-100）
ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS expected_close_date date;    -- 受注見込み日
ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS won_at date;                 -- 受注日（受注ステージ遷移時にセット）
ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS lost_reason text;            -- 見送り理由
ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS invoice_sent_at date;        -- 請求書送付日
ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS payment_due date;            -- 入金期日
ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS paid_at date;                -- 入金確認日
ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS last_contact_at timestamptz; -- 最終接触（統合フォローキュー用）

CREATE INDEX IF NOT EXISTS idx_business_cases_payment ON business_cases (paid_at, payment_due);

-- 顧問先の解約をMRRに反映できるようにする（is_active=falseで月額集計から除外）
ALTER TABLE client_dossiers ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
