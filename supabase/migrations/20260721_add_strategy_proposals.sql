-- 経営提案ボード（strategy_proposals）：new-biz-hypothesis / competitor-market-research / market-price-scan などの
-- スキルで出した提案を、01_経営幹部_Executive/配下のMarkdownに埋もれさせず一覧・ステータス管理するための受信トレイ。
-- 登録・更新はAI APIの自動呼び出しではなく、会長がこのチャットで「登録して」「まとめて」と指示した時にClaude Codeが
-- POST/PATCH /api/admin/strategy-proposals を叩いて書き込む運用（meeting_minutes_summaryと同じ手動トリガー方式）。
--
-- 注意：ensure_schema() の全文再定義はここでは行わない（20260810_add_dashboard_access_boundary.sql以降と同じ理由。
-- 古いスナップショットをベースに再定義すると、その間に追加されたテーブル定義が抜け落ちて事故る前例が複数回あったため）。
CREATE TABLE IF NOT EXISTS strategy_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'new_biz',
  source_skill text,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'unread',
  linked_biz_model_idea_id uuid REFERENCES biz_model_ideas(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_strategy_proposals_status ON strategy_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_proposals_category ON strategy_proposals (category, created_at DESC);
