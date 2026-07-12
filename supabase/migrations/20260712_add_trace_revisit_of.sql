-- ============================================================
-- 痕跡の「その後」機能
-- 同じ場所にまた来た時、元の痕跡がどう変化したかを新しい痕跡として記録する。
-- revisit_of が入っている行は「別の痕跡の、その後の記録」を意味する。
-- 既存の traces テーブルの仕組み（写真・位置・感情タグ）をそのまま使い回せるよう、
-- 新しいテーブルは作らず自己参照の列を1本足すだけにする。
-- ============================================================
alter table public.traces
  add column if not exists revisit_of uuid references public.traces(id) on delete set null;

create index if not exists idx_traces_revisit_of on public.traces (revisit_of) where revisit_of is not null;
