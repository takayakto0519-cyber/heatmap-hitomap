-- AIエージェント稼働状況の同期スナップショット。
-- ローカル（会長の開発機）で動いているエージェントの最新結果を、agents/sync_status_to_supabase.py が
-- 定期的にここへ書き込む。hitomap.com（本番）の運営ダッシュボードは、ローカルファイルに
-- アクセスできないため、このテーブル経由で「最終同期」時点の状況を表示する。
CREATE TABLE IF NOT EXISTS agent_status_snapshot (
  agent_id text PRIMARY KEY,
  name text NOT NULL,
  emoji text,
  floor text,
  schedule text,
  result jsonb,
  generated_at timestamptz,
  level integer,
  xp integer,
  synced_at timestamptz DEFAULT now()
);
ALTER TABLE agent_status_snapshot ENABLE ROW LEVEL SECURITY;
