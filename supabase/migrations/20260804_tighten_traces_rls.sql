-- traces の UPDATE / DELETE を anon キーから叩けなくする。
--
-- 経緯: MVP期の 20260623_rls_update_delete.sql が「フロント側でdevice所有判定」を
-- 前提に USING(true) で全開放していたが、現在は投稿の更新・削除がすべて
-- Next.js の API Route（service_role キー・RLSバイパス）経由になっており、
-- クライアントから anon キーで traces を直接 UPDATE/DELETE するコードは存在しない。
-- 開放ポリシーは「anon キーさえ知っていれば誰でも他人の投稿を書き換え・削除できる」
-- 抜け穴でしかないため撤去する。service_role は RLS の影響を受けないので挙動は変わらない。

DROP POLICY IF EXISTS "Anyone can update" ON traces;
DROP POLICY IF EXISTS "Anyone can delete" ON traces;

-- SELECT / INSERT の既存ポリシーは変更しない（公開閲覧・投稿受付は API 層で制御済み）。
