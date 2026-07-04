-- 地域×アーカイブ拡張：地名・言い伝え・文献・人の声を traces に追加
-- archive_type が NULL の行は従来の「痕跡」投稿としてそのまま扱う
ALTER TABLE traces ADD COLUMN IF NOT EXISTS archive_type text;    -- chimei | denshou | bunken | koe
ALTER TABLE traces ADD COLUMN IF NOT EXISTS yomi text;            -- 地名の読み
ALTER TABLE traces ADD COLUMN IF NOT EXISTS alt_names text;       -- 別名・旧称（カンマ区切り）
ALTER TABLE traces ADD COLUMN IF NOT EXISTS era_label text;       -- 時代・年代（自由記述）
ALTER TABLE traces ADD COLUMN IF NOT EXISTS source_ref text;      -- 文献の出典・URL
ALTER TABLE traces ADD COLUMN IF NOT EXISTS voice_relation text;  -- resident | former_resident | visitor | heard
ALTER TABLE traces ADD COLUMN IF NOT EXISTS audio_url text;       -- 言い伝え・人の声の録音（trace-photosバケットのURL）

CREATE INDEX IF NOT EXISTS idx_traces_archive_type ON traces (archive_type);

-- /api/migrate から呼ばれる自動マイグレーション関数。
-- 既存カラム＋アーカイブ列をすべて冪等に追加する（Supabase SQL Editor で実行）。
CREATE OR REPLACE FUNCTION ensure_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS emotion_key text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS intensity integer DEFAULT 3;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS category text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS trace_type text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS is_past_memory boolean DEFAULT false;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS memory_date text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS custom_tags text[];
  -- 地域×アーカイブ列
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS archive_type text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS yomi text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS alt_names text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS era_label text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS source_ref text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS voice_relation text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS audio_url text;
  CREATE INDEX IF NOT EXISTS idx_traces_archive_type ON traces (archive_type);
END;
$$;
