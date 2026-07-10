-- relay型イベントは投稿ルートが事前に決まっていないため、運営がスタート・ゴール地点だけピンとして先に設定できるようにする
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_start_lat double precision;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_start_lng double precision;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_start_label text;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_end_lat double precision;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_end_lng double precision;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_end_label text;
