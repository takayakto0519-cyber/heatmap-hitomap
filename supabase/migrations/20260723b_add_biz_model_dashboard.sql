-- 事業ライン専用ダッシュボード（自治体向けデジタル観光大使AI等）の伴走支援基盤。
-- どの営業先がどのビジネスモデル案から生まれたかを追跡し、実行フェーズを進行管理する。
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS linked_biz_model_idea_id uuid REFERENCES biz_model_ideas(id) ON DELETE SET NULL;
ALTER TABLE biz_model_ideas ADD COLUMN IF NOT EXISTS phase integer NOT NULL DEFAULT 0; -- 0=ショーケース確立 1=MVP 2=展開 3=スケール

-- 事業ラインの伴走ログ（打ち合わせ・決定事項・マイルストーンの時系列）。case_eventsと同じ形。
CREATE TABLE IF NOT EXISTS biz_model_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  biz_model_idea_id uuid NOT NULL REFERENCES biz_model_ideas(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'note', -- meeting | decision | milestone | note
  title text NOT NULL,
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biz_model_events_idea ON biz_model_events (biz_model_idea_id, occurred_at DESC);
ALTER TABLE biz_model_events ENABLE ROW LEVEL SECURITY;
