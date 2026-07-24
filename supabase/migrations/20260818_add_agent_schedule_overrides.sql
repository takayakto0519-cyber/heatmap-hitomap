-- 運営ダッシュボード「AIエージェント」タブから番人の実行時刻を変更できるようにする。
-- lib/agents/roster.ts の schedule 文字列がデフォルト値、ここにある行だけ上書きされる。
-- 実際にWindowsタスクスケジューラへ反映するのは agents/schedule_sync.py（毎朝05:00起動）で、
-- ダッシュボードで変更してもすぐには効かず、翌朝の同期後から有効になる（正直に運用UIで案内する）。
CREATE TABLE IF NOT EXISTS agent_schedule_overrides (
  agent_id text PRIMARY KEY,   -- lib/agents/roster.ts の id（=agents/配下のスクリプトファイル名、拡張子なし）
  time text NOT NULL,          -- "HH:MM"（24時間表記）。schtasks /ST にそのまま渡す
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE agent_schedule_overrides ENABLE ROW LEVEL SECURITY;
