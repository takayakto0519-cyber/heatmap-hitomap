-- 営業メールの送信範囲を事前に担当者へ割り当てられるようにする。
-- 会長・小田（他、team_membersに登録されたメンバー）が手分けして送信する際、
-- 送信キュー（components/admin/sales/SendQueuePanel.tsx）で範囲を選んで一括割り当てし、
-- 各自「自分の担当分だけ表示」で絞り込めるようにするための列。
-- team_membersへの外部キーにはしない（team_membersはid基準・action_items.ownerと同じく
-- 自由記述の名前で運用しているため、既存の運用と揃える）。

ALTER TABLE client_leads ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE sales_email_targets ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE municipality_profiles ADD COLUMN IF NOT EXISTS assigned_to text;
