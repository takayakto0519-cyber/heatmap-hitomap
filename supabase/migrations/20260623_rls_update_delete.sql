-- 自分の投稿の編集・削除を許可（MVP: フロント側でdevice所有判定）
CREATE POLICY "Anyone can update" ON traces FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete" ON traces FOR DELETE USING (true);
