-- 通報機能：不適切な投稿を利用者が運営に知らせるための仕組み
CREATE TABLE IF NOT EXISTS trace_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid REFERENCES traces(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_session text,
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text
);

ALTER TABLE trace_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert a report" ON trace_reports;
CREATE POLICY "Anyone can insert a report" ON trace_reports FOR INSERT TO anon, authenticated WITH CHECK (true);
-- SELECT/UPDATE/DELETEポリシーは付与しない。管理画面は service-role 経由（supabaseServer）で読むためRLSをバイパスする。
-- 一般ユーザーが他人の通報内容や件数を見られないようにする（通報の悪用・逆恨みを防ぐため）。

CREATE INDEX IF NOT EXISTS idx_trace_reports_status ON trace_reports (status);
CREATE INDEX IF NOT EXISTS idx_trace_reports_trace_id ON trace_reports (trace_id);

-- /api/migrate から呼ばれる自動マイグレーション関数に反映（既存の冪等マイグレーション関数を再定義）
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

  CREATE TABLE IF NOT EXISTS trace_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id uuid REFERENCES traces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type text NOT NULL DEFAULT 'empathy',
    created_at timestamptz DEFAULT now(),
    UNIQUE (trace_id, user_id, reaction_type)
  );
  CREATE INDEX IF NOT EXISTS idx_trace_reactions_trace_id ON trace_reactions (trace_id);

  CREATE TABLE IF NOT EXISTS bookmarks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    trace_id uuid REFERENCES traces(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, trace_id)
  );
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks (user_id);

  CREATE TABLE IF NOT EXISTS trace_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id uuid REFERENCES traces(id) ON DELETE CASCADE,
    reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_session text,
    reason text NOT NULL,
    note text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    reviewed_by text
  );
  CREATE INDEX IF NOT EXISTS idx_trace_reports_status ON trace_reports (status);
  CREATE INDEX IF NOT EXISTS idx_trace_reports_trace_id ON trace_reports (trace_id);
END;
$$;
