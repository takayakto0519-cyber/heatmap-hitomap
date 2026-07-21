-- 運営メンバー（team_members）：To-Doの担当・カレンダーの予定担当者として選べる名簿。
-- 「会長」のような役職の呼び方ではなく実名で管理し、メンバーが増えても
-- コード側を直さずダッシュボードから追加・編集できるようにする。
-- is_lead: 一覧の並び順で先頭に出す1名（旧「会長」枠）。複数名にtrueを付けても動くが、
-- 通常は代表者1名だけを想定。
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  is_lead boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members (is_active, sort_order);
