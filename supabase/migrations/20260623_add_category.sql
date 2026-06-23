-- カテゴリタグ列を追加（何に心が動いたか: 建物・植物・道具など）
ALTER TABLE traces ADD COLUMN IF NOT EXISTS category text;
