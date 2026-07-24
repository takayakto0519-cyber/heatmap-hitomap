-- 運営ダッシュボード内部の運用設定（公開サイトには影響しない値）を持つ汎用key-valueテーブル。
-- site_settings（トップページの文言等・公開サイトに直結しrevalidateSitePages()を伴う）とは
-- 意図的に分離する。例：key='sales_targets', value={"dailySendTarget": 10}
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
