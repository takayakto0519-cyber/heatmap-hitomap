-- 短い動画投稿・投稿の版管理（変更履歴）・すれ違い通知 を追加
ALTER TABLE traces ADD COLUMN IF NOT EXISTS video_url text;

CREATE TABLE IF NOT EXISTS trace_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid REFERENCES traces(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  edited_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trace_versions_trace_id ON trace_versions (trace_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'crossed_paths',
  trace_id uuid REFERENCES traces(id) ON DELETE CASCADE,       -- 通知の対象になった、自分の既存の投稿
  actor_trace_id uuid REFERENCES traces(id) ON DELETE CASCADE, -- きっかけになった、他の人の新しい投稿
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id, is_read);

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
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS audio_transcript text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public';
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS deleted_by text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS region text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS team text;
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS photo_urls text[];
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS video_url text;
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
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

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
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_slug text UNIQUE;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_cover_url text;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_starts_at timestamptz;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_ends_at timestamptz;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_area text;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_mode text DEFAULT 'route';
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_session_code text;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS is_public_recommendation boolean DEFAULT false;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS review_status text;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS highlights text;
  CREATE INDEX IF NOT EXISTS idx_routes_is_deleted ON routes (is_deleted);
  CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes (user_id);
  CREATE INDEX IF NOT EXISTS idx_routes_review_status ON routes (review_status);

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

  CREATE TABLE IF NOT EXISTS quests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    emoji text NOT NULL,
    title text NOT NULL,
    hint text NOT NULL,
    quest_type text NOT NULL DEFAULT 'search',
    target_emotion_key text,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_quests_is_active ON quests (is_active);

  CREATE TABLE IF NOT EXISTS trace_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id uuid REFERENCES traces(id) ON DELETE CASCADE,
    snapshot jsonb NOT NULL,
    edited_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_trace_versions_trace_id ON trace_versions (trace_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL DEFAULT 'crossed_paths',
    trace_id uuid REFERENCES traces(id) ON DELETE CASCADE,
    actor_trace_id uuid REFERENCES traces(id) ON DELETE CASCADE,
    message text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id, is_read);
END;
$$;
