-- 日程調整サイト（/schedule）を「訪問者が1枠だけ選んで即送信」から
-- 「訪問者が3つ以上の候補を出し、会長が確定画面で1つを選んで確定する」方式に変更する。
-- 急に別の予定が入った等の理由で、確定前に会長が候補の中から選び直せるようにするため。
--
-- requested_start/requested_end は「確定した1枠」を表す列として意味を変える
-- （送信直後はまだ確定していないのでNULL、会長が確定した時点で埋まる）。
-- 送信時点の候補一覧は candidate_slots（JSONB配列、[{start, end}, ...]）に保存する。

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS candidate_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE booking_requests
  ALTER COLUMN requested_start DROP NOT NULL,
  ALTER COLUMN requested_end DROP NOT NULL;

-- 既存の行（旧・単一候補方式で作られたもの）は、その1枠を候補配列に入れておく。
-- これらは既にrequested_start/endが確定値として埋まっているため、候補が1件だけの
-- 「確定待ち」または「確定済み」として運営ダッシュボード側でそのまま扱える。
UPDATE booking_requests
SET candidate_slots = jsonb_build_array(jsonb_build_object('start', requested_start, 'end', requested_end))
WHERE candidate_slots = '[]'::jsonb AND requested_start IS NOT NULL;
