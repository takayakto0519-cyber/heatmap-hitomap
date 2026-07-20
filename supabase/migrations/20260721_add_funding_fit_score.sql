-- funding_opportunities に「ヒトマップにどれだけ合うか」の目安を追加する。
-- ディープリサーチで見つけた案件を、締切だけでなく相性順にも並べられるようにする。
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS fit_score integer;      -- 0-100（高いほどヒトマップに合う）
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS fit_notes text;         -- なぜその点数にしたかの根拠
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_fit_score ON funding_opportunities (fit_score);
