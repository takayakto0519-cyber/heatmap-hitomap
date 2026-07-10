-- スタート・ゴールの間に経由地点を複数置けるようにする（経路を線でつなぐため）
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_waypoints jsonb;
