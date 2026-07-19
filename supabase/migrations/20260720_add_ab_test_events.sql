-- UI改善A/Bテスト自動集計AI（9F データ・分析R&D）用の記録表。
-- サイト側で test_key・variant を割り振ったタイミングで view を、成果が出たタイミングで
-- convert を1行ずつ書き込む想定（例：test_key='top_hero_copy', variant='A'|'B'）。
-- まだサイト側の計測コードが無い間はテーブルが空のままでよく、
-- agents/ab_test_summary_watch.py は0件でも「まだテストがありません」と静かに報告する。
CREATE TABLE IF NOT EXISTS ab_test_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_key text NOT NULL,
  variant text NOT NULL,
  event_type text NOT NULL DEFAULT 'view', -- view | convert
  session_code text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ab_test_events_test_key ON ab_test_events (test_key, variant, event_type);
ALTER TABLE ab_test_events ENABLE ROW LEVEL SECURITY;
