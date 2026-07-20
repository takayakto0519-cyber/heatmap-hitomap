-- 議事録の要約（meeting_minutes_summary）：直近3日分＋それより前のまとめを1本のテキストに統合して保持する単一行テーブル。
-- 更新はAI APIの自動呼び出しではなく、会長がこのチャットで「まとめて」と指示した時にClaude Codeが
-- PUT /api/admin/meeting-minutes/summary を叩いて書き込む運用（line_bot_settingsと同じ singleton パターン）。
--
-- 注意：ensure_schema() の全文再定義はここでは行わない（20260810_add_dashboard_access_boundary.sql と同じ理由。
-- 古いスナップショットをベースに再定義すると、その間に追加されたテーブル定義が抜け落ちて事故る前例が複数回あったため）。
CREATE TABLE IF NOT EXISTS meeting_minutes_summary (
  id text PRIMARY KEY DEFAULT 'main',
  summary text NOT NULL DEFAULT '',
  covers_through date,
  updated_at timestamptz DEFAULT now()
);
