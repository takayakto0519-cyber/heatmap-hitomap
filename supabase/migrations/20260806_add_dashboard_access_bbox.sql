-- 自治体ダッシュボードの表示範囲（地図bbox）を region文字列の代わりに指定できるようにする。
-- region名の表記ゆれ（大字・丁目単位のばらつき等）に左右されず、地図上で囲った範囲そのものを
-- 集計対象にできる。bboxが設定されているダッシュボードは region完全一致ではなくこちらを優先する。
--
-- 注意：ensure_schema() 関数へのこの変更の反映は、このファイル単体では行わない。
-- 20260729時点の古いスナップショットを元にすると、20260728〜20260805で追加された
-- appointment_requests・site_posts・site_blocks・bonno系・plan列などの定義が
-- 抜け落ちた不完全な関数で上書きしてしまう事故が過去にあったため（20260807_add_site_settings.sql
-- 参照）、ensure_schema() の全文再定義は「その時点で最新の全定義を含むマイグレーション」でのみ行う。
ALTER TABLE dashboard_access ADD COLUMN IF NOT EXISTS bbox_min_lat double precision;
ALTER TABLE dashboard_access ADD COLUMN IF NOT EXISTS bbox_max_lat double precision;
ALTER TABLE dashboard_access ADD COLUMN IF NOT EXISTS bbox_min_lng double precision;
ALTER TABLE dashboard_access ADD COLUMN IF NOT EXISTS bbox_max_lng double precision;
