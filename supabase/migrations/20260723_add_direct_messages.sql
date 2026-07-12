-- フォロワー間チャット（相互フォローの相手とのみ送受信できるダイレクトメッセージ）
CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  is_deleted boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_dm_pair_created ON direct_messages (sender_id, recipient_id, created_at);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
-- 送受信の当事者のみ閲覧可（書き込みはservice-roleクライアント経由でアプリ側の相互フォロー確認を通す）
DROP POLICY IF EXISTS "dm_select_own" ON direct_messages;
CREATE POLICY "dm_select_own" ON direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
