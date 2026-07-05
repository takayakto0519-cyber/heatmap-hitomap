-- アカウント・フォロー・公開範囲・ソフトデリート
-- 匿名投稿（user_id null）は従来どおり visibility='public' 即時公開のまま。
-- ログイン投稿のみ公開範囲（private/followers/pending_review/public）を選べる。

-- プロフィール（auth.users と1:1）
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  bio text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- フォロー関係
CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read follows" ON follows;
CREATE POLICY "Anyone can read follows" ON follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own follows" ON follows;
CREATE POLICY "Users manage own follows" ON follows FOR ALL USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- traces 拡張
ALTER TABLE traces ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE traces ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public';
ALTER TABLE traces ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE traces ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE traces ADD COLUMN IF NOT EXISTS deleted_by text;

CREATE INDEX IF NOT EXISTS idx_traces_user_id ON traces (user_id);
CREATE INDEX IF NOT EXISTS idx_traces_visibility ON traces (visibility);
CREATE INDEX IF NOT EXISTS idx_traces_is_deleted ON traces (is_deleted);

-- /api/migrate から呼ばれる自動マイグレーション関数（既存カラム＋今回の追加分を冪等に反映）
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
  CREATE INDEX IF NOT EXISTS idx_traces_archive_type ON traces (archive_type);
  CREATE INDEX IF NOT EXISTS idx_traces_user_id ON traces (user_id);
  CREATE INDEX IF NOT EXISTS idx_traces_visibility ON traces (visibility);
  CREATE INDEX IF NOT EXISTS idx_traces_is_deleted ON traces (is_deleted);

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
END;
$$;
