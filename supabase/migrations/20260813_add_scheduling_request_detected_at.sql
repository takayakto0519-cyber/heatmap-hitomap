-- gmail_watch.py の日程調整検知機能（受信箱全体から「日程調整を求める返信」を検知）用。
-- 検知した相手が該当テーブルに登録済みなら、いつ検知したかをここに記録する。
-- 未登録の相手（該当行が無い）はDiscord通知にだけ出て、この列には残らない。

ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS scheduling_request_detected_at timestamptz;
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS scheduling_request_detected_at timestamptz;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS scheduling_request_detected_at timestamptz;
