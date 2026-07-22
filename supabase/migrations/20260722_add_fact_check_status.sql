-- 営業メール下書きの事実確認状態を管理する列を追加する。
-- 目的：AIエージェントが調べた evidence_summary / email_draft の具体的な数字・固有名詞が
-- 出典ページと一致するかを確認しないまま送信キューに乗ることを防ぐ（誤送信ガードの追加レイヤー）。
-- 'unverified'（デフォルト）＝まだ出典と突き合わせていない。送信キューでは送信不可。
-- 'verified'　　　　　　　　＝出典と突き合わせ済み。送信キューで送信可能になりうる（宛先確度のガードは別途必要）。
-- 'flagged'　　　　　　　　 ＝確認の結果、修正が必要な記述が見つかった。送信キューでは送信不可。

ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS fact_check_status text DEFAULT 'unverified';
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS fact_check_note text;
ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS fact_checked_at timestamptz;

ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS fact_check_status text DEFAULT 'unverified';
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS fact_check_note text;
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS fact_checked_at timestamptz;

ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS fact_check_status text DEFAULT 'unverified';
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS fact_check_note text;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS fact_checked_at timestamptz;
