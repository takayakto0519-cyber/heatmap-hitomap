-- ============================================================
-- traces に感情タグ・強度を追加
-- emotion_key : ときめき/なつかしさ/切なさ/驚き/尊敬/あたたかさ
-- intensity   : 1〜5（ヒートマップの熱量・重みになる）
-- ============================================================
alter table public.traces
  add column if not exists emotion_key text,
  add column if not exists intensity   integer check (intensity between 1 and 5) default 3;

create index if not exists idx_traces_emotion_key on public.traces (emotion_key);
