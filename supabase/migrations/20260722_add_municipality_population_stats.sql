-- 自治体の人口統計（e-Stat経由・昼夜間人口比率など）を municipality_profiles にキャッシュする。
-- 国勢調査は5年に1度しか更新されないため、顧客ダッシュボードアクセスのたびにe-Statを
-- 叩くのではなく、運営ダッシュボードから手動取得した値をここに保存して都度読むだけにする。
--
-- municipality_code は全国地方公共団体コード5桁（lib/municipalityBoundary.tsのN03_007と同じ体系）。
-- population_stats は { dayNightRatio, statsYear, statsDataId, fetchedAt } 等を持つjsonb
-- （将来、宿泊者数などの指標を追加できるようスキーマを固定しない）。
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS municipality_code text;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS population_stats jsonb;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS population_stats_fetched_at timestamptz;
