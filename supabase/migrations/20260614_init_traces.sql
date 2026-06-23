-- ============================================================
-- ヒトマップ MVP マイグレーション
-- 作成: 20260614
-- 目的: ワークショップで収集する「痕跡(trace)」の器を定義する
-- 方針: 匿名性を担保 / 入力負荷を最小 / 1週間・5人の実験に耐える最小構成
-- ============================================================

-- gen_random_uuid() のため
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- traces : 投稿（痕跡）本体
-- ------------------------------------------------------------
create table if not exists public.traces (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- 写真（Supabase Storage の公開URL or パス）
  photo_url       text,

  -- 位置情報
  latitude        double precision not null,
  longitude       double precision not null,

  -- 必須の問い（3つの言語化）
  title           text not null,            -- タイトル
  why             text,                     -- なぜ気になったか (Why)
  interpretation  text,                     -- どんな暮らしが見えたか (Interpretation)
  self_reflection text,                     -- 自分の記憶・感情とどうつながったか (Self-Reflection)

  -- 追加項目（ワンタップで答えられる軽い問い）
  want_revisit    boolean not null default false,  -- もう一度来たいか
  want_to_share   boolean not null default false,  -- 誰かに話したいか

  -- 実験運用メタ（匿名・任意）
  session_code    text,                     -- 実験回の識別（例: 'ws-20260620'）
  nickname        text                      -- 任意のニックネーム（本名は求めない）
);

-- 位置・実験回での絞り込みを速くする
create index if not exists idx_traces_session  on public.traces (session_code);
create index if not exists idx_traces_location on public.traces (latitude, longitude);
create index if not exists idx_traces_created  on public.traces (created_at desc);

-- ------------------------------------------------------------
-- Row Level Security
-- MVP方針: 匿名で投稿・閲覧できる。削除/更新は禁止（運用者がダッシュボードで管理）
-- ------------------------------------------------------------
alter table public.traces enable row level security;

-- 誰でも投稿できる（匿名 anon ロール）
create policy "anyone can insert traces"
  on public.traces for insert
  to anon, authenticated
  with check (true);

-- 誰でも閲覧できる（レポート/マップ表示のため）
create policy "anyone can read traces"
  on public.traces for select
  to anon, authenticated
  using (true);

-- ------------------------------------------------------------
-- Storage バケット（写真）
-- 注: バケット作成は Supabase ダッシュボード or 下記SQLで実行
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('trace-photos', 'trace-photos', true)
on conflict (id) do nothing;

-- 匿名アップロードを許可（実験用。本番では制限すること）
create policy "anyone can upload trace photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'trace-photos');

create policy "anyone can read trace photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'trace-photos');
