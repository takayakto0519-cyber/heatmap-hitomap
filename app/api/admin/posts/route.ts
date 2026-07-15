// /api/admin/posts — 実績記事の管理（運営ダッシュボード用・パスワード必須）
//   GET  ... 下書き含む全記事
//   POST ... 新規作成
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { generateSlug } from '@/lib/sitePosts';

// post_type ごとに公開ページのパスを再検証する。
// /works・/blog は revalidate=300（5分ISR）のため、これを呼ばないと
// 運営ダッシュボードでの更新が最大5分反映されない。
function revalidatePostPaths(postType: string | undefined, slug: string) {
  const listPath = postType === 'blog' ? '/blog' : '/works';
  revalidatePath(listPath);
  revalidatePath(`${listPath}/${slug}`);
}

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('site_posts')
    .select('*')
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, posts: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    title?: string; category?: string; post_type?: string; related_slug?: string | null;
    event_date?: string | null; body?: string;
    cover_url?: string | null; photo_urls?: string[]; testimonials?: { name: string; comment: string }[];
    is_published?: boolean;
  };
  const title = (body.title ?? '').trim();
  if (!title) return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('site_posts')
    .insert({
      slug: generateSlug(body.event_date),
      title,
      category: body.category ?? 'event',
      post_type: body.post_type ?? 'achievement',
      related_slug: body.related_slug || null,
      event_date: body.event_date || null,
      body: body.body ?? '',
      cover_url: body.cover_url || null,
      photo_urls: body.photo_urls ?? [],
      testimonials: body.testimonials ?? [],
      is_published: Boolean(body.is_published),
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  revalidatePostPaths(data.post_type, data.slug);
  return NextResponse.json({ ok: true, post: data });
}
