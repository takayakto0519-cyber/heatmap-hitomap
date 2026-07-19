-- 資金調達・コンテストカレンダー（funding_opportunities）：
-- 自治体のスタートアップ支援・補助金・ビジネスモデルコンテスト・資金調達/ピッチイベントの
-- エントリー締切を横断管理する。既存のbiz_model_ideas（応募案の中身）とは別レイヤーで、
-- 「そもそも何に応募できるか」を発見・追跡するための台帳。
CREATE TABLE IF NOT EXISTS funding_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  organizer text,                          -- 主催者（自治体名・省庁・企業等）
  opp_type text NOT NULL DEFAULT 'contest', -- municipal_support | subsidy | contest | funding_event
  region text,                              -- 対象地域（NULL=全国）
  deadline date,                            -- エントリー締切（不明な場合はNULL）
  deadline_note text,                       -- 締切が不明瞭・ローリング等の補足
  announcement_date date,                   -- 結果発表・二次審査等の予定日
  prize_amount text,                        -- 賞金・助成額・調達額レンジ（自由記述）
  url text,
  status text NOT NULL DEFAULT 'watching',  -- watching | preparing | submitted | won | rejected | passed
  memo text,
  source text,                              -- どこで見つけたか（検索・紹介・スキル名等）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_deadline ON funding_opportunities (deadline);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_type ON funding_opportunities (opp_type);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_status ON funding_opportunities (status);
ALTER TABLE funding_opportunities ENABLE ROW LEVEL SECURITY;
