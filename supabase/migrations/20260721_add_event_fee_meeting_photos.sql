-- イベントの参加費・集合場所などの詳細情報、および複数枚写真を追加
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_fee text;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_meeting_info text;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS event_photo_urls text[];
