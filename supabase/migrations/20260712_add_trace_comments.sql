-- ============================================================
-- 痕跡へのコメント機能
-- 公開されている痕跡に対して、ログインユーザーが短いコメントを残せるようにする。
-- 匿名投稿への荒らし対策として、コメントはログイン必須にする（reactions/bookmarksと同じ方針）。
-- ============================================================
create table if not exists public.trace_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trace_id uuid not null references public.traces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

create index if not exists idx_trace_comments_trace_id on public.trace_comments (trace_id) where is_deleted = false;

alter table public.trace_comments enable row level security;

-- 削除されていないコメントは誰でも閲覧可能（痕跡自体の公開範囲チェックはAPI側で行う）
drop policy if exists "trace_comments_select" on public.trace_comments;
create policy "trace_comments_select" on public.trace_comments
  for select using (is_deleted = false);

-- 投稿は本人名義でのみ可能
drop policy if exists "trace_comments_insert" on public.trace_comments;
create policy "trace_comments_insert" on public.trace_comments
  for insert with check (auth.uid() = user_id);

-- 削除（ソフトデリート）は本人のコメントのみ
drop policy if exists "trace_comments_update_own" on public.trace_comments;
create policy "trace_comments_update_own" on public.trace_comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
