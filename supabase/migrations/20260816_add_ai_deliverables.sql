-- AI成果物パイプライン：「番人が検知 → AIが作る → 会長が承認か差し戻し」を全業務の共通形にする。
-- AIが作ったものを実体テーブル（municipality_profiles.email_draft 等）へ直接書かず、
-- いったんこの作業場に置く。承認された時だけ実体へ反映する。こうすることで
--   ・既存の運用UI（RelationPopulationTab等）を壊さない
--   ・差し戻し時の「改善点」と、作り直しのリビジョン履歴を残せる
-- ※ ensure_schema() の再定義は行わない（過去にテーブル定義が抜け落ちる事故があったため、
--    近年のマイグレーションと同様に単体のCREATE/ALTER文のみとする）。

CREATE TABLE IF NOT EXISTS ai_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,                 -- municipality_profile | client_lead | biz_model_idea | sns | new_biz
  entity_id uuid,                            -- 対象の行（新規事業仮説など対象が無いものは null）
  kind text NOT NULL,                        -- email_draft | followup_draft | reply_draft | evidence | contact
                                             -- | requirements | mvp_content | quote_research | sns_post | biz_hypothesis
  status text NOT NULL DEFAULT 'proposed',   -- proposed(AI生成・会長未確認) | approved | revise(差し戻し) | archived(却下)
  title text NOT NULL,
  body text NOT NULL DEFAULT '',             -- 成果物の本体（メール文面・MVP構成案など）
  ai_note text,                              -- AIが何をしたかの1〜2行（会長が最初に読む行）
  sources text,                              -- 参照した出典URL（改行区切り）
  feedback text,                             -- 会長の差し戻しコメント ← 次回のAI実行がこれを読む
  rebuild boolean NOT NULL DEFAULT false,    -- true なら前案を捨てて一から作り直す（false は部分修正）
  revision integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES ai_deliverables(id) ON DELETE SET NULL,  -- 前リビジョンの行
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_deliverables_queue ON ai_deliverables (status, entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_deliverables_entity ON ai_deliverables (entity_type, entity_id, created_at DESC);
ALTER TABLE ai_deliverables ENABLE ROW LEVEL SECURITY;

-- 自治体営業トラック（lib/tracks/govOutreach.ts）のうち、既存カラムから導出できない事実だけを追加する。
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS hearing_at timestamptz;       -- M7 ヒアリング面談を実施した日時
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS requirements_memo text;       -- M8 面談から起こした要件メモ
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS mvp_shown_at timestamptz;     -- M9 MVPデモを提示した日時（＝フェーズ1到達）
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS quoted_at timestamptz;        -- M10 見積を提出した日時

-- 自治体ごとの伴走ログは biz_model_events を再利用する（新テーブルを作らない）。
ALTER TABLE biz_model_events ADD COLUMN IF NOT EXISTS municipality_profile_id uuid REFERENCES municipality_profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_biz_model_events_muni ON biz_model_events (municipality_profile_id, occurred_at DESC);
