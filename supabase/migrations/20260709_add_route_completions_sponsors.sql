-- ルート踏破の記録（無料版スタンプラリーの土台。決済は伴わない）
CREATE TABLE IF NOT EXISTS route_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  nickname text,
  completed_at timestamptz DEFAULT now()
);

ALTER TABLE route_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read completions" ON route_completions;
CREATE POLICY "Anyone can read completions" ON route_completions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert completions" ON route_completions;
CREATE POLICY "Anyone can insert completions" ON route_completions FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_route_completions_route_id ON route_completions (route_id);

-- ルートの協賛表示（手動設定、決済は伴わない。契約自体はアプリ外で行う）
ALTER TABLE routes ADD COLUMN IF NOT EXISTS sponsor_name text;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS sponsor_url text;

-- 地域(region)・寄り道モード向けのスポンサー枠（手動設定、決済は伴わない）
CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement text NOT NULL,     -- 'region' | 'detour'
  region text,                 -- placement='region' のとき対象の自治体名
  name text NOT NULL,
  message text,
  url text,
  latitude double precision,   -- placement='detour' のとき掲載位置
  longitude double precision,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active sponsors" ON sponsors;
CREATE POLICY "Anyone can read active sponsors" ON sponsors FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_sponsors_region ON sponsors (region);
CREATE INDEX IF NOT EXISTS idx_sponsors_placement ON sponsors (placement);

-- ensure_schema() にも反映（既存の冪等マイグレーション関数を再定義）
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
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS sponsor_name text;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS sponsor_url text;
  CREATE INDEX IF NOT EXISTS idx_routes_is_deleted ON routes (is_deleted);
  CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes (user_id);

  CREATE TABLE IF NOT EXISTS route_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    nickname text,
    completed_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_route_completions_route_id ON route_completions (route_id);

  CREATE TABLE IF NOT EXISTS sponsors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    placement text NOT NULL,
    region text,
    name text NOT NULL,
    message text,
    url text,
    latitude double precision,
    longitude double precision,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_sponsors_region ON sponsors (region);
  CREATE INDEX IF NOT EXISTS idx_sponsors_placement ON sponsors (placement);
END;
$$;
