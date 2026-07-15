// /api/admin/blocks — サイトブロックの管理（運営ダッシュボード用・パスワード必須）
//   GET  ?page=home ... 非表示含む全ブロック
//   POST ... 新規作成（末尾に追加）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const page = req.nextUrl.searchParams.get('page') ?? 'home';
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('site_blocks')
    .select('*')
    .eq('page', page)
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, blocks: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    page?: string; block_type?: string; eyebrow?: string | null; heading?: string | null;
    body?: string | null; image_url?: string | null; cta_label?: string | null; cta_href?: string | null;
    items?: unknown[]; is_visible?: boolean;
  };
  if (!body.block_type) return NextResponse.json({ ok: false, error: 'block_type は必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const page = body.page ?? 'home';

  // 末尾に追加：現在の最大sort_orderを取得してから+1
  const { data: maxRows } = await supabaseServer
    .from('site_blocks')
    .select('sort_order')
    .eq('page', page)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = ((maxRows?.[0]?.sort_order as number | undefined) ?? -1) + 1;

  const { data, error } = await supabaseServer
    .from('site_blocks')
    .insert({
      page,
      sort_order: nextOrder,
      block_type: body.block_type,
      eyebrow: body.eyebrow ?? null,
      heading: body.heading ?? null,
      body: body.body ?? null,
      image_url: body.image_url ?? null,
      cta_label: body.cta_label ?? null,
      cta_href: body.cta_href ?? null,
      items: body.items ?? [],
      is_visible: body.is_visible ?? true,
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, block: data });
}
