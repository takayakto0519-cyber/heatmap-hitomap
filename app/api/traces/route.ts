// ============================================================
// /api/traces : 痕跡データの受け口
//   POST  ... 投稿を1件保存（Googleフォーム中継 / アプリ投稿 共通）
//   GET   ... 一覧取得（マップ・カード・レポート用）
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import type {
  CreateTraceRequest,
  CreateTraceResponse,
  ListTracesResponse,
  Trace,
} from '@/lib/types';
import { SAMPLE_TRACES } from '@/lib/sampleTraces';
import { getCurrentUserId } from '@/lib/supabase/requestClient';
import { notifyDiscord, notifyDiscordError } from '@/lib/discord';
import { haversine } from '@/lib/geo';
import { isRateLimited } from '@/lib/rateLimit';

const CROSSED_PATHS_RADIUS_M = 50;

// すれ違い通知：新しい投稿の近くに、別の登録ユーザーの既存の公開投稿があれば知らせる（失敗しても投稿自体は継続する）
async function notifyCrossedPaths(
  supabaseServer: Awaited<ReturnType<typeof getServerClient>>,
  newTrace: Trace
) {
  try {
    const degRadius = (CROSSED_PATHS_RADIUS_M / 111000) * 1.5;
    const { data: nearby } = await supabaseServer
      .from('traces')
      .select('id, user_id, title, latitude, longitude')
      .eq('is_deleted', false)
      .eq('visibility', 'public')
      .not('user_id', 'is', null)
      .neq('id', newTrace.id)
      .gte('latitude', newTrace.latitude - degRadius)
      .lte('latitude', newTrace.latitude + degRadius)
      .gte('longitude', newTrace.longitude - degRadius)
      .lte('longitude', newTrace.longitude + degRadius);

    const notifiedUsers = new Set<string>();
    for (const t of nearby ?? []) {
      const ownerId = t.user_id as string;
      if (ownerId === newTrace.user_id || notifiedUsers.has(ownerId)) continue;
      if (haversine(newTrace.latitude, newTrace.longitude, t.latitude, t.longitude) > CROSSED_PATHS_RADIUS_M) continue;
      notifiedUsers.add(ownerId);
      await supabaseServer.from('notifications').insert({
        user_id: ownerId,
        type: 'crossed_paths',
        trace_id: t.id,
        actor_trace_id: newTrace.id,
        message: `あなたが「${t.title}」を残した場所に、新しい痕跡「${newTrace.title}」が残されました`,
      });
    }
  } catch {
    // notifications未作成の環境でも投稿自体は継続させる
  }
}

// Supabaseが設定済みかどうか。未設定ならローカル確認用のサンプルにフォールバック。
const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

// 座標→自治体名（例：「大阪府浪速区」）。Nominatim利用規約に従いUser-Agentを付与。失敗時はnullを返し投稿自体は継続する。
async function reverseGeocodeRegion(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ja&zoom=14`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Hitomap/1.0 (hitomap.info@gmail.com)' } });
    if (!res.ok) return null;
    const data = await res.json() as { address?: Record<string, string> };
    const a = data.address ?? {};
    const city = a.city || a.town || a.village || a.county;
    if (!city) return null;
    return a.state ? `${a.state}${city}` : city;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<CreateTraceResponse>> {
  try {
    // まち歩き中の連続投稿は自然な使い方なので窓は緩め（1分間に12件まで）。スクリプト連投だけを弾く
    if (isRateLimited(req, 'traces', 60_000, 12)) {
      return NextResponse.json(
        { ok: false, error: '投稿が続きすぎています。少し時間をおいてから再度お試しください' },
        { status: 429 }
      );
    }

    const body = (await req.json()) as CreateTraceRequest;

    // 最低限のバリデーション（入力負荷を下げるため必須は title と座標のみ）
    if (!body.title || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'title・latitude・longitude は必須です' },
        { status: 400 }
      );
    }
    if (
      Number.isNaN(body.latitude) || Number.isNaN(body.longitude) ||
      body.latitude < -90 || body.latitude > 90 ||
      body.longitude < -180 || body.longitude > 180
    ) {
      return NextResponse.json(
        { ok: false, error: '緯度・経度の値が不正です' },
        { status: 400 }
      );
    }

    if (!SUPABASE_READY) {
      return NextResponse.json(
        { ok: false, error: 'Supabase未設定（ローカル確認モード）。.env.localにキーを設定してください' },
        { status: 503 }
      );
    }

    const userId = await getCurrentUserId();
    const team = body.team?.trim() || null;
    const supabaseServer = await getServerClient();

    // 匿名投稿は全国公開前に運営審査を通す（pending_review）。ログイン投稿のみ公開範囲を選べる（private/followers/pending_review）。
    // ただしリレー型イベント参加（team指定あり）の投稿は、ログイン有無にかかわらず必ずpublicにする。
    // ログイン投稿はデフォルトprivateになるため、そのままだとチームメンバー同士に投稿が見えなくなってしまう。
    const allowedVisibility = ['private', 'followers', 'pending_review'];
    let visibility = team
      ? 'public'
      : userId && body.visibility && allowedVisibility.includes(body.visibility)
        ? body.visibility
        : userId ? 'private' : 'pending_review';

    // 運営が個別に信頼をおいたユーザー（profiles.auto_approve）は、審査待ちにせず即座に全国公開する
    if (visibility === 'pending_review' && userId) {
      const { data: profile } = await supabaseServer
        .from('profiles').select('auto_approve').eq('id', userId).maybeSingle();
      if (profile?.auto_approve) visibility = 'public';
    }

    const region = await reverseGeocodeRegion(body.latitude, body.longitude);

    const photoUrls = (body.photo_urls ?? []).filter(Boolean).slice(0, 4);
    const photoUrl = photoUrls[0] ?? body.photo_url ?? null;
    const { data, error } = await supabaseServer
      .from('traces')
      .insert({
        photo_url: photoUrl,
        photo_urls: photoUrls.length > 0 ? photoUrls : (photoUrl ? [photoUrl] : null),
        region,
        latitude: body.latitude,
        longitude: body.longitude,
        title: body.title,
        why: body.why ?? null,
        interpretation: body.interpretation ?? null,
        self_reflection: body.self_reflection ?? null,
        want_revisit: body.want_revisit ?? false,
        want_to_share: body.want_to_share ?? false,
        emotion_key: body.emotion_key ?? null,
        intensity: body.intensity ?? 3,
        category: body.category ?? null,
        trace_type: body.trace_type ?? null,
        is_past_memory: body.is_past_memory ?? false,
        memory_date: body.memory_date ?? null,
        custom_tags: body.custom_tags ?? null,
        archive_type: body.archive_type ?? null,
        yomi: body.yomi ?? null,
        alt_names: body.alt_names ?? null,
        era_label: body.era_label ?? null,
        source_ref: body.source_ref ?? null,
        voice_relation: body.voice_relation ?? null,
        audio_url: body.audio_url ?? null,
        audio_transcript: body.audio_transcript ?? null,
        session_code: body.session_code ?? null,
        nickname: body.nickname ?? null,
        team,
        user_id: userId,
        visibility,
        // video_url / emotion_keys / revisit_of は未マイグレーション環境でも既存投稿が壊れないよう、指定時のみ送る
        ...(body.video_url ? { video_url: body.video_url } : {}),
        ...(body.emotion_keys && body.emotion_keys.length > 0 ? { emotion_keys: body.emotion_keys } : {}),
        ...(body.revisit_of ? { revisit_of: body.revisit_of } : {}),
        ...(body.companion_tag ? { companion_tag: body.companion_tag } : {}),
      })
      .select()
      .single();

    if (error) {
      notifyDiscordError('POST /api/traces', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const who = userId ? 'ログイン投稿' : '匿名投稿';
    const statusNote = visibility === 'pending_review' ? '⏳ 審査待ち（匿名投稿）' : `公開範囲: ${visibility}`;
    notifyDiscord(
      `📍 新しい痕跡が投稿されました\n**${body.title}**${region ? `（${region}）` : ''}\n${who} ・ ${statusNote}`
    );

    if (visibility === 'public') {
      await notifyCrossedPaths(supabaseServer, data as Trace);
    }

    return NextResponse.json({ ok: true, trace: data as Trace }, { status: 201 });
  } catch (e) {
    notifyDiscordError('POST /api/traces', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse<ListTracesResponse>> {
  const sessionCode = req.nextUrl.searchParams.get('session_code');
  const region = req.nextUrl.searchParams.get('region');
  const userIdFilter = req.nextUrl.searchParams.get('user_id');
  const revisitOf = req.nextUrl.searchParams.get('revisit_of');
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 200);

  // Supabase未設定時はサンプルを返す（ブラウザでの動作確認用）
  if (!SUPABASE_READY) {
    const traces = sessionCode
      ? SAMPLE_TRACES.filter((t) => t.session_code === sessionCode)
      : SAMPLE_TRACES;
    return NextResponse.json({ ok: true, traces: traces.slice(0, limit) });
  }

  const supabaseServer = await getServerClient();
  const userId = await getCurrentUserId();

  let query = supabaseServer
    .from('traces')
    .select('*')
    .eq('is_deleted', false);

  if (!userId) {
    // 未ログイン閲覧者には public のみ
    query = query.eq('visibility', 'public');
  } else {
    const { data: followRows } = await supabaseServer
      .from('follows').select('followee_id').eq('follower_id', userId);
    const followingIds = (followRows ?? []).map((r) => r.followee_id);

    const orParts = ['visibility.eq.public', `user_id.eq.${userId}`];
    if (followingIds.length > 0) {
      orParts.push(`and(visibility.eq.followers,user_id.in.(${followingIds.join(',')}))`);
    }
    query = query.or(orParts.join(','));
  }

  query = query.order('created_at', { ascending: false }).limit(limit);

  if (sessionCode) query = query.eq('session_code', sessionCode);
  if (region) query = query.eq('region', region);
  if (userIdFilter) query = query.eq('user_id', userIdFilter);
  if (revisitOf) query = query.eq('revisit_of', revisitOf);

  const { data, error } = await query;

  if (error) {
    notifyDiscordError('GET /api/traces', error);
    return NextResponse.json({ ok: false, traces: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, traces: (data ?? []) as Trace[] });
}
