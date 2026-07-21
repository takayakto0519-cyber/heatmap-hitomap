-- 公開日程調整サイト（Part B）用の受付箱。行政面談専用ではなく、会長の日常的な
-- あらゆる日程調整（商談・打合せ・個人の予定含む）に汎用的に使う想定のため、
-- 特定のリード・自治体・案件テーブルへの外部キーは持たせない（誰が使っても同じ1つの受付箱）。
--
-- 送信直後はcalendarには一切書き込まず、status='pending'で保存するだけ（仮リクエスト方式）。
-- 会長が管理画面で「確定」を押した時だけ、実際にGoogleカレンダーへイベントが作成され、
-- calendar_event_idが埋まる。却下時はstatusだけ更新し、カレンダーには触れない。

CREATE TABLE IF NOT EXISTS booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  purpose text,
  duration_minutes integer NOT NULL DEFAULT 30,
  requested_start timestamptz NOT NULL,
  requested_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending / confirmed / declined
  calendar_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests (status, requested_start);

ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
-- 読み書きはすべてサーバー側(service role)経由のAPIルートのみで行う。
-- 匿名クライアントからの直接アクセスは許可しない（他の運営系テーブルと同じ方針）。
