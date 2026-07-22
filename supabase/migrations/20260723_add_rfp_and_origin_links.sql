-- 公募（RFP）と自治体台帳のリンク（公募情報はfunding_opportunitiesが唯一の置き場＝二重管理しない）
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS municipality_profile_id uuid REFERENCES municipality_profiles(id) ON DELETE SET NULL;
-- 受注後の伴走導線：自治体案件をbusiness_casesに引き継ぐ時のリンク
ALTER TABLE business_cases ADD COLUMN IF NOT EXISTS municipality_profile_id uuid REFERENCES municipality_profiles(id) ON DELETE SET NULL;
-- 「なぜこの営業先か」：新規事業案・戦略提案からの由来
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS origin_proposal_id uuid REFERENCES strategy_proposals(id) ON DELETE SET NULL;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS origin_note text;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS origin_proposal_id uuid REFERENCES strategy_proposals(id) ON DELETE SET NULL;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS origin_note text;

-- 案件専用ダッシュボードの伴走ログ（打ち合わせ・電話・メモ・マイルストーンの時系列）
CREATE TABLE IF NOT EXISTS case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES business_cases(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'note', -- meeting | call | email | note | milestone
  title text NOT NULL,
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_events_case ON case_events (case_id, occurred_at DESC);
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
