-- 記録で育つキャラクターに、本人だけがつけられる名前を追加する。
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS character_name text;
