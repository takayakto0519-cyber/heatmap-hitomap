import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/requestClient';
import { notifyDiscord, notifyDiscordError } from '@/lib/discord';

// GET /api/profile — 自分のプロフィール取得（未ログインなら user:null）
export async function GET() {
  const supabase = createRequestClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ ok: true, user: null, profile: null });
  }
  let { data: profile } = await supabase
    .from('profiles').select('*').eq('id', userData.user.id).maybeSingle();

  if (!profile) {
    // メール確認必須の設定では、signUp直後はセッションが無くプロフィールを作れない。
    // 希望していたユーザー名はuser_metadataに載せてあるので、確認後の初回ログイン時にここで作成する。
    const pendingUsername = userData.user.user_metadata?.username;
    // Googleログイン等、user_metadataにusernameが無い場合は仮のユーザー名を自動発行する。
    // これが無いとプロフィール行自体が永遠に作られず、マイページが「登録されていません」のまま
    // 動かなくなってしまう（本人はいつでも/profileページから改名できる）。
    const usernameToUse =
      typeof pendingUsername === 'string' && pendingUsername.trim()
        ? pendingUsername.trim()
        : `user${userData.user.id.replace(/-/g, '').slice(0, 8)}`;
    const { data: created, error } = await supabase
      .from('profiles')
      .insert({ id: userData.user.id, username: usernameToUse })
      .select().single();
    if (!error) {
      profile = created;
      notifyDiscord(`👤 新しいアカウントが登録されました\n@${created.username}`);
    }
    // 重複等で作成に失敗した場合もprofile:nullのまま返す（呼び出し側でユーザー名再設定を促す）
  }

  return NextResponse.json({ ok: true, user: { id: userData.user.id, email: userData.user.email }, profile });
}

// POST /api/profile — 初回のusername登録（重複不可）
export async function POST(req: NextRequest) {
  const supabase = createRequestClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { username?: string; display_name?: string; bio?: string };
  const username = body.username?.normalize('NFC').trim();
  if (!username) {
    return NextResponse.json({ ok: false, error: 'ユーザー名は必須です' }, { status: 400 });
  }
  // /profile/[username] のURLに直接使われるため、スラッシュ等URLを壊す文字は禁止する。
  if (!/^[\p{L}\p{N}_-]{1,30}$/u.test(username)) {
    return NextResponse.json({ ok: false, error: 'ユーザー名に使えるのは文字・数字・「_」「-」のみです（30文字まで）' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userData.user.id, username, display_name: body.display_name ?? null, bio: body.bio ?? null })
    .select().single();
  if (error) {
    if (error.code !== '23505') notifyDiscordError('POST /api/profile', error);
    const msg = error.code === '23505' ? 'そのユーザー名は既に使われています' : error.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  notifyDiscord(`👤 新しいアカウントが登録されました\n@${data.username}`);
  return NextResponse.json({ ok: true, profile: data });
}

// PATCH /api/profile — display_name・bio の更新
export async function PATCH(req: NextRequest) {
  const supabase = createRequestClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { display_name?: string; bio?: string; avatar_url?: string };
  const updates: Record<string, unknown> = {};
  if ('display_name' in body) updates.display_name = body.display_name ?? null;
  if ('bio' in body) updates.bio = body.bio ?? null;
  if ('avatar_url' in body) updates.avatar_url = body.avatar_url ?? null;
  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', userData.user.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data });
}
