-- 学校・法人リード（client_leads）にも自治体プロファイル（municipality_profiles）と同じ
-- 「証拠パック」欄を持たせる。カラム名・意味を完全に揃えることで、営業タブの統合カード
-- （SalesEntryCard）が両テーブルを区別せず同じ根拠・出典表示ロジックを使えるようにする。
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS evidence_summary text;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS source_links text;
