-- 痕跡ルート：複数の痕跡を順番につなげ、「この人が歩いた道」として公開する
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  trace_ids uuid[] NOT NULL DEFAULT '{}',
  nickname text,
  user_id uuid REFERENCES auth.users(id),
  session_code text,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read routes" ON routes;
CREATE POLICY "Anyone can read routes" ON routes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert routes" ON routes;
CREATE POLICY "Anyone can insert routes" ON routes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update routes" ON routes;
CREATE POLICY "Anyone can update routes" ON routes FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_routes_is_deleted ON routes (is_deleted);
CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes (user_id);

-- ensure_schema() に routes テーブル作成も追加（既存の冪等マイグレーション関数を再定義）
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
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS archive_type text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS yomi text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS alt_names text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS era_label text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS source_ref text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS voice_relation text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS audio_url text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public';
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS deleted_by text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS region text;
  CREATE INDEX IF NOT EXISTS idx_traces_archive_type ON traces (archive_type);
  CREATE INDEX IF NOT EXISTS idx_traces_user_id ON traces (user_id);
  CREATE INDEX IF NOT EXISTS idx_traces_visibility ON traces (visibility);
  CREATE INDEX IF NOT EXISTS idx_traces_is_deleted ON traces (is_deleted);
  CREATE INDEX IF NOT EXISTS idx_traces_region ON traces (region);

  CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE NOT NULL,
    display_name text,
    bio text,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    followee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id)
  );

  CREATE TABLE IF NOT EXISTS routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    trace_ids uuid[] NOT NULL DEFAULT '{}',
    nickname text,
    user_id uuid REFERENCES auth.users(id),
    session_code text,
    is_deleted boolean DEFAULT false,
    deleted_at timestamptz,
    deleted_by text,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_routes_is_deleted ON routes (is_deleted);
  CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes (user_id);
END;
$$;
