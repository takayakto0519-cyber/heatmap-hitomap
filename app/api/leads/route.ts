// POST /api/leads — 法人・学校・自治体からの公開問い合わせフォームの受け口。
// client_leads に直接insertし、/admin/dashboard「学校・法人」タブに即座に載る。
// これまで/company/contactはmailto頼みで、問い合わせがclient_leadsに一切繋がっていなかった。
import { NextRequest, NextResponse } from 'next/server';
import { notifyDiscord } from '@/lib/discord';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const MAX_LEN = 500;

// 連投荒らし対策：IPごとの投稿回数を時間窓で制限（app/api/bonno/route.ts と同じインメモリ方式）
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_POSTS = 5;
const postCounts = new Map<string, { count: number; windowStart: number }>();

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

function isRateLimited(req: NextRequest): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = postCounts.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    postCounts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX_POSTS;
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (isRateLimited(req)) {
    return NextResponse.json({ ok: false, error: '送信回数が多すぎます。しばらくしてから再度お試しください' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as {
    client_type?: string; org_name?: string; contact_name?: string;
    email?: string; phone?: string; memo?: string; website?: string; // website = ハニーポット
  };

  // ハニーポット：人間には見えない項目が埋まっていたらbotとみなし、成功したフリだけして無視する
  if (body.website) {
    return NextResponse.json({ ok: true });
  }

  const orgName = body.org_name?.trim().slice(0, MAX_LEN) ?? '';
  const contactName = body.contact_name?.trim().slice(0, MAX_LEN) ?? '';
  const email = body.email?.trim().slice(0, MAX_LEN) ?? '';
  const phone = body.phone?.trim().slice(0, MAX_LEN) ?? '';
  const memo = body.memo?.trim().slice(0, MAX_LEN) ?? '';
  const clientType = ['school', 'municipality'].includes(body.client_type ?? '') ? (body.client_type as string) : 'business';

  if (!orgName) {
    return NextResponse.json({ ok: false, error: '団体名・組織名を入力してください' }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: 'メールアドレスか電話番号のどちらかを入力してください' }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('client_leads')
    .insert({
      client_type: clientType,
      org_name: orgName,
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
      memo: memo || null,
    })
    .select('id').single();

  if (error) {
    return NextResponse.json({ ok: false, error: '送信に失敗しました。時間をおいて再度お試しください' }, { status: 500 });
  }

  const clientTypeLabel = clientType === 'school' ? '学校' : clientType === 'municipality' ? '自治体' : '法人';
  notifyDiscord(
    `📮 新しい問い合わせが届きました（${clientTypeLabel}）\n`
    + `団体名：${orgName}\n担当者：${contactName || '未記入'}\n連絡先：${email || phone}\n`
    + `運営ダッシュボードの「学校・法人」タブから確認してください`
  );

  // 受付確認の自動返信（定型文のみ・営業文面は含まない）。失敗しても問い合わせ自体は成功扱いにする。
  if (email) {
    try {
      const { sendEmail } = await import('@/lib/gmailServer');
      await sendEmail({
        to: email,
        subject: '【ヒトマップ】お問い合わせを受け付けました',
        body: `${contactName || orgName} 様\n\n`
          + `この度はヒトマップへお問い合わせいただき、ありがとうございます。\n`
          + `以下の内容で受け付けました。内容を確認のうえ、担当より折り返しご連絡いたします。\n\n`
          + `団体名：${orgName}\nご相談内容：${memo || '（未記入）'}\n\n`
          + `お急ぎの場合は、こちらから無料相談の日程を直接お選びいただけます。\n`
          + `https://hitomap.com/schedule\n\n`
          + `--\nヒトマップ\nhitomap.info@gmail.com`,
      });
    } catch (e) {
      console.error('問い合わせ受付メールの送信に失敗しました', e);
    }
  }

  return NextResponse.json({ ok: true, id: data.id });
}
