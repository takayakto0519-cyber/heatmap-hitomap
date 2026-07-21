// 営業デモ用の合成データを本番Supabaseに投入するスクリプト。
//
// 目的：感情ヒートマップ・愛着ファネル（地→理→心）・イベント前後の感情変化・
// 自治体向けダッシュボードを、実データが薄い段階でも商談でその場で動かして見せられるようにする。
//
// 投入するものはすべて「デモ架空市」という架空の地域名に閉じ、タイトルに【デモ】を付け、
// session_code='demo-sales-20260720' で一括タグ付けする。
// 削除する場合は scripts/cleanup-demo-sales-data.mjs を実行すること。
//
// 使い方:
//   node scripts/seed-demo-sales-data.mjs
// 環境変数は .env.local から読み込む（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）。

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が .env.local に必要です');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SESSION_CODE = 'demo-sales-20260720';
const REGION = 'デモ架空市';
const EVENT_SLUG = 'demo-sales-event-20260720';
const DEMO_EMAIL_DOMAIN = 'demo-sales.hitomap.invalid'; // 実在しないダミードメイン。メール送信は一切発生しない

// デモ架空市の中心座標（実在の自治体と重ならないよう、海上に近い架空の地点をあえて使う）
const CENTER = { lat: 35.317, lng: 139.72 }; // 東京湾上の一点（実在の街と紐付かない）

function jitter(base, meters) {
  const deg = meters / 111_000;
  return base + (Math.random() - 0.5) * 2 * deg;
}

function daysAgo(n, hour = 12) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

const POSITIVE_KEYS = ['tokimeki', 'natsukashii', 'kandou', 'atatakasa', 'anshin', 'tanoshisa', 'hokorashisa'];
const NEGATIVE_KEYS = ['setsunai'];
const NEUTRAL_KEYS = ['odoroki', 'fushigi'];

function pickEmotions() {
  const r = Math.random();
  // 好意的多め（7割）・否定的1割・中立2割 という、自治体向けサマリーで見栄えのする自然な分布
  if (r < 0.7) return [POSITIVE_KEYS[Math.floor(Math.random() * POSITIVE_KEYS.length)]];
  if (r < 0.8) return [NEGATIVE_KEYS[0]];
  return [NEUTRAL_KEYS[Math.floor(Math.random() * NEUTRAL_KEYS.length)]];
}

const TITLES = [
  '商店街の裏路地で古い看板を見つけた',
  '神社の階段で近所のおばあちゃんに挨拶された',
  '駅前のパン屋の焼きたての匂いに足が止まった',
  '川沿いの桜並木で花見をする家族を見た',
  '公民館の掲示板で手書きのお知らせを見つけた',
  '祭りの準備をしている人たちの掛け声を聞いた',
  '空き家だった古民家がカフェに変わっていた',
  '夕方の田んぼで蛙の声を聞きながら歩いた',
  '地元の高校生が挨拶してくれた',
  '商店主が店先を掃除している姿に見とれた',
  '古い写真館の看板に懐かしさを感じた',
  '朝市でおすすめの野菜を教えてもらった',
];

const WHY = [
  'なぜかその場から離れられなかった。',
  '昔住んでいた町を思い出した。',
  '誰かの生活の気配がそこにあった。',
  'ここで暮らす人の時間の流れを感じた。',
];

async function ensureDemoUsers(n) {
  const users = [];
  for (let i = 1; i <= n; i++) {
    const email = `demo-user-${String(i).padStart(2, '0')}@${DEMO_EMAIL_DOMAIN}`;
    // 既存なら作らない（再実行の冪等性）
    const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = existing?.users?.find((u) => u.email === email);
    if (found) {
      users.push(found.id);
      continue;
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: `demo-sales-${Math.random().toString(36).slice(2)}!`,
      email_confirm: true,
      user_metadata: { demo_sales_seed: SESSION_CODE, display_name: `デモ利用者${i}` },
    });
    if (error) throw new Error(`createUser失敗(${email}): ${error.message}`);
    users.push(data.user.id);
  }
  return users;
}

async function insertTrace({ userId, title, dayOffset, region = REGION, revisitOf = null, visibility = 'private' }) {
  const emotionKeys = pickEmotions();
  const intensity = 1 + Math.floor(Math.random() * 5);
  const { data, error } = await supabase
    .from('traces')
    .insert({
      user_id: userId,
      title: `【デモ】${title}`,
      why: WHY[Math.floor(Math.random() * WHY.length)],
      interpretation: 'ここに暮らす人の必然を、痕跡から想像した。',
      self_reflection: null,
      latitude: jitter(CENTER.lat, 400),
      longitude: jitter(CENTER.lng, 400),
      emotion_key: emotionKeys[0],
      emotion_keys: emotionKeys,
      intensity,
      region,
      visibility,
      session_code: SESSION_CODE,
      want_revisit: Math.random() < 0.4,
      revisit_of: revisitOf,
      created_at: daysAgo(dayOffset, 9 + Math.floor(Math.random() * 10)),
    })
    .select('id, user_id, created_at')
    .single();
  if (error) throw new Error(`traces insert失敗: ${error.message}`);
  return data;
}

async function main() {
  console.log('デモ利用者アカウントを準備中...');
  const userIds = await ensureDemoUsers(14); // chi>=5 の抑制しきい値を十分超える人数

  console.log('痕跡（過去6週間・デモ架空市）を投入中...');
  const traces = [];
  // 地：14人全員が最低1件、うち半数は複数日にわたって記録（心＝再訪の母数を作る）
  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const t1 = await insertTrace({
      userId,
      title: TITLES[i % TITLES.length],
      dayOffset: 7 + Math.floor(Math.random() * 35),
    });
    traces.push(t1);

    if (i % 2 === 0) {
      // 再訪記録（「その後」＝心の段階）
      const t2 = await insertTrace({
        userId,
        title: TITLES[(i + 3) % TITLES.length],
        dayOffset: Math.floor(Math.random() * 6), // 直近1週間以内の再訪
        revisitOf: t1.id,
      });
      traces.push(t2);
    }
  }

  console.log('共感リアクション・コメント（理の段階）を投入中...');
  for (const trace of traces) {
    const reactorCount = 1 + Math.floor(Math.random() * 3);
    const reactors = userIds.filter((u) => u !== trace.user_id).sort(() => Math.random() - 0.5).slice(0, reactorCount);
    for (const reactorId of reactors) {
      const reactionType = ['empathy', 'want_to_walk', 'natsukashii'][Math.floor(Math.random() * 3)];
      await supabase.from('trace_reactions').insert({
        trace_id: trace.id,
        user_id: reactorId,
        reaction_type: reactionType,
      });
    }
    if (Math.random() < 0.4) {
      const commenter = userIds.filter((u) => u !== trace.user_id)[Math.floor(Math.random() * (userIds.length - 1))];
      await supabase.from('trace_comments').insert({
        trace_id: trace.id,
        user_id: commenter,
        body: 'わかります、この空気感。',
      });
    }
  }

  console.log('会いたい申請（心の段階）を投入中...');
  for (let i = 0; i < 5; i++) {
    const requester = userIds[i];
    const requestee = userIds[(i + 1) % userIds.length];
    await supabase.from('appointment_requests').insert({
      requester_id: requester,
      requestee_id: requestee,
      trace_id: traces[i]?.id ?? null,
      purpose: 'この場所についてもっと話を聞いてみたい',
      status: 'accepted',
      responded_at: daysAgo(Math.floor(Math.random() * 5)),
    });
  }

  console.log('イベント（前後の感情変化デモ）を投入中...');
  const eventStart = daysAgo(10, 10);
  const eventEnd = daysAgo(9, 17);
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .insert({
      title: '【デモ】デモ架空市 まち歩きイベント',
      description: '営業デモ用の架空イベント。前後の感情変化サンプルを見せるために作成。',
      trace_ids: [],
      session_code: SESSION_CODE,
      event_slug: EVENT_SLUG,
      event_starts_at: eventStart,
      event_ends_at: eventEnd,
      event_session_code: SESSION_CODE,
      event_area: REGION,
      event_mode: 'route',
    })
    .select('id')
    .single();
  if (routeError) throw new Error(`routes insert失敗: ${routeError.message}`);

  // イベント参加者5人の「前・中・後」記録を作る
  const participants = userIds.slice(0, 6);
  for (const userId of participants) {
    await insertTrace({ userId, title: '事前の下見で見つけた気になる場所', dayOffset: 20 }); // 前
    await insertTrace({ userId, title: 'イベント中にガイドと歩いた道', dayOffset: 9 });        // 中（イベント期間内）
    await insertTrace({ userId, title: 'イベント後にもう一度訪れた場所', dayOffset: 2 });        // 後・再訪
  }

  console.log('自治体向けダッシュボードのデモトークンを準備中...');
  const { data: lead, error: leadError } = await supabase
    .from('client_leads')
    .upsert(
      { org_name: '【デモ】架空市役所（営業デモ用サンプル）', client_type: 'business', status: 'negotiating', memo: SESSION_CODE },
      { onConflict: 'org_name' }
    )
    .select('id')
    .maybeSingle();
  let leadId = lead?.id;
  if (!leadId) {
    const { data: created, error: createErr } = await supabase
      .from('client_leads')
      .insert({ org_name: '【デモ】架空市役所（営業デモ用サンプル）', client_type: 'business', status: 'negotiating', memo: SESSION_CODE })
      .select('id')
      .single();
    if (createErr) throw new Error(`client_leads insert失敗: ${createErr.message}`);
    leadId = created.id;
  }
  if (leadError) console.warn('client_leads upsert警告（無視可）:', leadError.message);

  const demoToken = `demo-${SESSION_CODE}`;
  const { error: dashError } = await supabase
    .from('dashboard_access')
    .upsert(
      {
        client_lead_id: leadId,
        token: demoToken,
        region: REGION,
        label: '【デモ】感情ヒートマップ営業デモ',
        is_active: true,
      },
      { onConflict: 'token' }
    );
  if (dashError) throw new Error(`dashboard_access insert失敗: ${dashError.message}`);

  console.log('\n=== 完了 ===');
  console.log(`投入した痕跡: ${traces.length + participants.length * 3}件`);
  console.log(`デモ利用者: ${userIds.length}人`);
  console.log(`イベントslug: ${EVENT_SLUG}`);
  console.log(`ダッシュボードURL: /dashboard/${demoToken}`);
  console.log(`地域名（地図・地域ページ用）: ${REGION}`);
  console.log(`\n削除する場合は: node scripts/cleanup-demo-sales-data.mjs`);
}

main().catch((err) => {
  console.error('失敗:', err.message);
  process.exit(1);
});
