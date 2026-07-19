-- 縁の台帳（en_records）：営業を「縁の方程式」で運用するための記録表。
-- リード（client_leads）ごとに 痕跡(trace)・余白(yohaku)・共動(action)・推譲(suijo) の
-- 4種類の記録を書き溜め、縁スコア（lib/enScore.ts）の材料にする。
-- ※ensure_schema()は再定義しない（退行事故防止のため単独テーブル追加のみ）。
CREATE TABLE IF NOT EXISTS en_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES client_leads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('trace', 'yohaku', 'action', 'suijo')),
  note text NOT NULL,
  happened_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_en_records_lead_id ON en_records (lead_id);
CREATE INDEX IF NOT EXISTS idx_en_records_kind ON en_records (kind);
-- anonキーからのREST直読みを防ぐ（APIはservice roleで読むためポリシー不要）
ALTER TABLE en_records ENABLE ROW LEVEL SECURITY;
