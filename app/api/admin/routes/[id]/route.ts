import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

// イベントページはSupabaseへのfetchがNext.jsのData Cacheに乗るため、更新しても最大数分反映されない。
// 管理画面での更新・公開/非公開切り替えを即時反映させる。
function revalidateEventPaths(slug: string | null | undefined) {
  if (!slug) return;
  revalidatePath(`/events/${slug}`);
  revalidatePath(`/events/${slug}/wall`);
  revalidatePath(`/events/${slug}/console`);
  revalidatePath(`/events/${slug}/analysis`);
  revalidatePath('/routes');
  revalidatePath('/');
}

interface RouteAdminUpdateBody {
  sponsor_name?: string | null;
  sponsor_url?: string | null;
  event_slug?: string | null;
  event_cover_url?: string | null;
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  event_area?: string | null;
  event_mode?: string | null;
  event_session_code?: string | null;
  review_status?: string | null;
  event_start_lat?: number | null;
  event_start_lng?: number | null;
  event_start_label?: string | null;
  event_end_lat?: number | null;
  event_end_lng?: number | null;
  event_end_label?: string | null;
  event_waypoints?: { lat: number; lng: number; label: string }[] | null;
  event_fee?: string | null;
  event_meeting_info?: string | null;
  event_photo_urls?: string[] | null;
  is_public_recommendation?: boolean;
}

const ALLOWED_FIELDS: (keyof RouteAdminUpdateBody)[] = [
  'sponsor_name', 'sponsor_url',
  'event_slug', 'event_cover_url', 'event_starts_at', 'event_ends_at', 'event_area',
  'event_mode', 'event_session_code', 'review_status',
  'event_start_lat', 'event_start_lng', 'event_start_label',
  'event_end_lat', 'event_end_lng', 'event_end_label',
  'event_waypoints',
  'event_fee', 'event_meeting_info', 'event_photo_urls',
  'is_public_recommendation',
];

// PATCH /api/admin/routes/[id] — 協賛・イベント公開情報の設定（手動、決済は伴わない。パスワード必須）
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }
  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as RouteAdminUpdateBody;
  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key];
  }
  // 管理画面から直接「掲載する」と操作した場合は、ユーザー投稿用の審査待ちフローを経由させず即時承認する
  if (updates.is_public_recommendation === true && !('review_status' in updates)) {
    updates.review_status = 'approved';
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: before } = await supabaseServer.from('routes').select('event_slug').eq('id', id).maybeSingle();
  const { data, error } = await supabaseServer.from('routes').update(updates).eq('id', id).select().single();
  if (error) {
    const message = error.message.includes('routes_event_slug_key')
      ? 'このURL（スラッグ）は既に使われています'
      : error.message;
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
  revalidateEventPaths(before?.event_slug as string | undefined);
  revalidateEventPaths(data.event_slug as string | undefined);
  return NextResponse.json({ ok: true, route: data });
}
