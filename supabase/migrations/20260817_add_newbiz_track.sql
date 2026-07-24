-- 新規事業開発トラック（NB1仮説→NB2検証→NB3 MVP設計）のための追加カラム。
-- 新規事業の登録先は必ず biz_model_ideas（.claude/skills/new-biz-hypothesis/SKILL.md に
-- 明記された2026-07-23の反省：strategy_proposalsに新規事業カテゴリを重複して作らない）。
-- 既存の report_md（事業計画の自由記述）とは別に、検証結果・MVP仕様は専用カラムに分ける
-- ——AI提案の反映先（lib/deliverables.ts の REFLECT_TO）を1カラム1kindに保つため。

ALTER TABLE biz_model_ideas ADD COLUMN IF NOT EXISTS validation_summary text;      -- NB2: 需要検証の結果（saas-demand-validation）
ALTER TABLE biz_model_ideas ADD COLUMN IF NOT EXISTS validated_at timestamptz;
ALTER TABLE biz_model_ideas ADD COLUMN IF NOT EXISTS mvp_spec_md text;             -- NB3: MVP仕様書（mvp-spec）
ALTER TABLE biz_model_ideas ADD COLUMN IF NOT EXISTS mvp_spec_at timestamptz;
