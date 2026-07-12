-- ============================================================
-- 感情タグの複数選択対応
-- emotion_key（単一・既存）は先頭に選んだ感情として維持し、
-- ヒートマップ色・共鳴マッチング・クエスト判定など既存ロジックの後方互換を保つ。
-- emotion_keys（配列・新規）に選択したすべての感情を保存する。
-- ============================================================
alter table public.traces
  add column if not exists emotion_keys text[];

create index if not exists idx_traces_emotion_keys on public.traces using gin (emotion_keys);
