-- agents/fact_check_watch.py が検出したneeds_review（要確認候補）を、ローカルJSON
-- （work/fact_check_watch.json）だけでなくここにも書く。本番ダッシュボード（Vercel等）は
-- このPCのローカルファイルに直接アクセスできないため、このテーブル経由で読む。
-- fact_check_statusは一切変更しない（人間判断を経ないとverifiedにしない設計を壊さない、
-- 2026-07-22の「瀬戸内ワークス」誤判定事故の教訓を踏まえる）。
CREATE TABLE IF NOT EXISTS fact_check_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'municipality',
  claim text NOT NULL,
  reason text,
  detected_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fact_check_flags_profile ON fact_check_flags (profile_id);
