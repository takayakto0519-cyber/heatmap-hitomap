-- 実績ブログ（site_posts）：複数日程のイベントに対応するため終了日を追加。
-- event_date は開始日として扱う。単日イベントは event_date_end を NULL のままにする。
ALTER TABLE site_posts ADD COLUMN IF NOT EXISTS event_date_end date;

-- /api/migrate から呼ばれる自動マイグレーション関数に反映（既存の冪等マイグレーション関数を再定義。全定義を維持したまま追記）
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
  ALTER TABLE traces ADD COLUMN IF NOT EXISTS companion_tag text;
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
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_approve boolean NOT NULL DEFAULT false;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_updated_at timestamptz;

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
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS bonno_requires_moderation boolean NOT NULL DEFAULT false;
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

  CREATE TABLE IF NOT EXISTS event_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    memo text,
    status text NOT NULL DEFAULT 'idea',
    event_date date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_event_plans_status ON event_plans (status);

  CREATE TABLE IF NOT EXISTS client_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_type text NOT NULL DEFAULT 'business',
    org_name text NOT NULL,
    contact_name text,
    email text,
    phone text,
    status text NOT NULL DEFAULT 'lead',
    memo text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_client_leads_client_type ON client_leads (client_type);
  CREATE INDEX IF NOT EXISTS idx_client_leads_status ON client_leads (status);

  CREATE TABLE IF NOT EXISTS comment_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid REFERENCES trace_comments(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type text NOT NULL DEFAULT 'like',
    created_at timestamptz DEFAULT now(),
    UNIQUE (comment_id, user_id, reaction_type)
  );
  CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions (comment_id);

  CREATE TABLE IF NOT EXISTS appointment_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    requestee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    trace_id uuid REFERENCES traces(id) ON DELETE SET NULL,
    purpose text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    responded_at timestamptz
  );
  CREATE INDEX IF NOT EXISTS idx_appointment_requests_requestee ON appointment_requests (requestee_id, status);
  CREATE INDEX IF NOT EXISTS idx_appointment_requests_requester ON appointment_requests (requester_id);

  CREATE TABLE IF NOT EXISTS dashboard_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_lead_id uuid REFERENCES client_leads(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    region text NOT NULL,
    label text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz
  );
  ALTER TABLE dashboard_access ADD COLUMN IF NOT EXISTS bbox_min_lat double precision;
  ALTER TABLE dashboard_access ADD COLUMN IF NOT EXISTS bbox_max_lat double precision;
  ALTER TABLE dashboard_access ADD COLUMN IF NOT EXISTS bbox_min_lng double precision;
  ALTER TABLE dashboard_access ADD COLUMN IF NOT EXISTS bbox_max_lng double precision;
  CREATE INDEX IF NOT EXISTS idx_dashboard_access_token ON dashboard_access (token);
  CREATE INDEX IF NOT EXISTS idx_dashboard_access_client_lead_id ON dashboard_access (client_lead_id);

  CREATE TABLE IF NOT EXISTS site_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    title text NOT NULL,
    category text NOT NULL DEFAULT 'event',
    event_date date,
    body text NOT NULL DEFAULT '',
    cover_url text,
    photo_urls text[] NOT NULL DEFAULT '{}',
    testimonials jsonb NOT NULL DEFAULT '[]',
    is_published boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  ALTER TABLE site_posts ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'achievement';
  ALTER TABLE site_posts ADD COLUMN IF NOT EXISTS related_slug text;
  ALTER TABLE site_posts ADD COLUMN IF NOT EXISTS event_date_end date;
  CREATE INDEX IF NOT EXISTS idx_site_posts_published ON site_posts (is_published, event_date DESC);
  CREATE INDEX IF NOT EXISTS idx_site_posts_post_type ON site_posts (post_type, is_published);

  CREATE TABLE IF NOT EXISTS site_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page text NOT NULL DEFAULT 'home',
    sort_order integer NOT NULL DEFAULT 0,
    block_type text NOT NULL,
    eyebrow text,
    heading text,
    body text,
    image_url text,
    cta_label text,
    cta_href text,
    items jsonb NOT NULL DEFAULT '[]',
    is_visible boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_site_blocks_page ON site_blocks (page, sort_order);

  CREATE TABLE IF NOT EXISTS bonno_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_slug text NOT NULL,
    text text NOT NULL,
    nickname text,
    status text NOT NULL DEFAULT 'visible',
    featured_at timestamptz,
    intensity_score integer,
    ai_keywords text[],
    analyzed_at timestamptz,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_bonno_event_status ON bonno_submissions (event_slug, status);
  ALTER TABLE bonno_submissions ENABLE ROW LEVEL SECURITY;

  CREATE TABLE IF NOT EXISTS bonno_investments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_slug text NOT NULL,
    submission_id uuid NOT NULL REFERENCES bonno_submissions(id) ON DELETE CASCADE,
    voter_token text NOT NULL,
    amount integer NOT NULL CHECK (amount > 0),
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_bonno_investments_submission ON bonno_investments (submission_id);
  CREATE INDEX IF NOT EXISTS idx_bonno_investments_voter ON bonno_investments (event_slug, voter_token);
  ALTER TABLE bonno_investments ENABLE ROW LEVEL SECURITY;

  CREATE TABLE IF NOT EXISTS site_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL DEFAULT '{}',
    updated_at timestamptz DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sns_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    platform text NOT NULL DEFAULT 'instagram',
    title text NOT NULL,
    caption text NOT NULL DEFAULT '',
    image_url text,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    posted_at timestamptz
  );
  CREATE INDEX IF NOT EXISTS idx_sns_drafts_status ON sns_drafts (status, created_at DESC);

  CREATE TABLE IF NOT EXISTS biz_model_ideas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    memo text,
    status text NOT NULL DEFAULT 'idea',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_biz_model_ideas_status ON biz_model_ideas (status, created_at DESC);

  CREATE TABLE IF NOT EXISTS meeting_minutes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date date NOT NULL DEFAULT CURRENT_DATE,
    title text,
    participants text,
    body text NOT NULL DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_meeting_minutes_entry_date ON meeting_minutes (entry_date DESC);
END;
$$;
