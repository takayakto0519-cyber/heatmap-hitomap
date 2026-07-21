// scripts/seed-demo-sales-data.mjs で作った土台を拡張し、アプリのほぼ全機能に
// デモ利用者が「投稿・反応・つながり」を作った状態を再現するスクリプト。
//
// 追加するもの（すべて visibility='private' ＝ 運営（service-role）以外には見えない）：
//   - 痕跡50件（写真プレースホルダー・音声メモ・アーカイブ系項目・タグ・誰と、を含むフルバリエーション）
//   - 共感リアクション・コメント・コメントへのリアクション
//   - ブックマーク
//   - フォロー関係・ダイレクトメッセージ（相互フォローの相手にのみ）
//   - 会いたい申請（pending / declined を追加、既存はaccepted）
//   - 通報（トレース・レポート機能の動作確認用）
//   - 通常のおすすめルート（イベント外）＋ルート踏破記録
//
// 既存の scripts/seed-demo-sales-data.mjs で作った14人のデモ利用者・session_code をそのまま使う。
// 公開/非公開の切り替えは運営ダッシュボード（縁の司令室タブ）の「デモデータ」トグルが
// session_code単位で一括制御するため、ここで増やした分もそのまま同じトグルの対象になる。
//
// 使い方: node scripts/seed-demo-sales-data-expand.mjs

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SESSION_CODE = 'demo-sales-20260720';
const REGION = 'デモ架空市';
const DEMO_EMAIL_DOMAIN = 'demo-sales.hitomap.invalid';
const CENTER = { lat: 35.317, lng: 139.72 };
const VISIBILITY = 'private'; // 運営（service-role経由の管理画面）以外には見せない

let actionCount = 0; // 「何かしらの作業」の実績カウント（トレース以外の全レコード）
function tally(n = 1) { actionCount += n; }

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
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const POSITIVE_KEYS = ['tokimeki', 'natsukashii', 'kandou', 'atatakasa', 'anshin', 'tanoshisa', 'hokorashisa'];
const NEGATIVE_KEYS = ['setsunai'];
const NEUTRAL_KEYS = ['odoroki', 'fushigi'];
function pickEmotions() {
  const r = Math.random();
  if (r < 0.7) return [pick(POSITIVE_KEYS)];
  if (r < 0.8) return [NEGATIVE_KEYS[0]];
  return [pick(NEUTRAL_KEYS)];
}

// 写真ピン機能のデモ用：外部素材やアップロードを使わず、その場で生成したプレースホルダー画像
// （感情の色＋絵文字だけのSVG）をdata URIとして埋め込む。実在の写真ではないことが一目でわかる。
function placeholderPhoto(emoji, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480'><rect width='100%' height='100%' fill='${color}'/><text x='50%' y='54%' font-size='180' text-anchor='middle' dominant-baseline='middle'>${emoji}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const TITLES = [
  '路地裏の自動販売機がずっと同じ場所にあった',
  '銭湯の番台に貼られた古いポスターを見つけた',
  '橋の欄干に彫られた昔の落書きが残っていた',
  '八百屋の軒先で世間話をする人たちを見た',
  '踏切待ちの間に聞こえた誰かの鼻歌',
  '古本屋の均一棚に懐かしい表紙を見つけた',
  '公園のベンチに刻まれた名前の彫り跡',
  '夕暮れの土手で凧を揚げる親子を見た',
  '駄菓子屋のガラス戸を開けた音が懐かしかった',
  '町工場から漏れる機械音にリズムを感じた',
  '神社の絵馬に書かれた誰かの願い事を読んだ',
  '祭りのあと片付けをする人たちの背中を見た',
  '雨上がりの商店街に水たまりの反射が広がっていた',
  '古い理髪店の看板の文字がかすれていた',
  '畑仕事の合間に立ち話をするお年寄りを見た',
  '駅の伝言板に残された誰かのメッセージ',
  '夜の屋台から漂う出汁の匂いに足が止まった',
  '空き地に残された子どもの落書きを見つけた',
  '古い橋の名前の由来を刻んだ石碑を読んだ',
  '町内会の掲示板にお祭りの案内が貼られていた',
];

const WHY = [
  'なぜかその場から離れられなかった。',
  '昔住んでいた町を思い出した。',
  '誰かの生活の気配がそこにあった。',
  'ここで暮らす人の時間の流れを感じた。',
  '自分の記憶のどこかと重なった。',
];

const CATEGORIES = ['暮らし', '自然', '商店', '祭り・行事', '建物'];
const CUSTOM_TAG_POOL = ['夕方', '雨上がり', '祭りの余韻', '路地', '手仕事', '子どもの声', '静けさ'];
const COMPANION_TAGS = ['一人で', '家族と', '友人と', '偶然出会った人と', '地元の人に案内されて'];

async function getDemoUsers() {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = (data?.users ?? []).filter((u) => u.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`));
  if (users.length === 0) throw new Error('デモ利用者が見つかりません。先に scripts/seed-demo-sales-data.mjs を実行してください。');
  return users.map((u) => u.id);
}

async function insertTrace(userId, i) {
  const emotionKeys = pickEmotions();
  const intensity = 1 + Math.floor(Math.random() * 5);
  const isArchive = i % 6 === 0;   // 一部を「古い記録・アーカイブ」系の項目でも試す
  const hasPhoto = i % 3 === 0;    // 一部に写真ピンのプレースホルダーを付ける
  const hasAudio = i % 7 === 0;    // 一部に音声メモの文字起こしを付ける
  const emotion = emotionKeys[0];
  const colorByValence = NEGATIVE_KEYS.includes(emotion) ? '#6A89CC' : NEUTRAL_KEYS.includes(emotion) ? '#A29BFE' : '#F6B93B';

  const row = {
    user_id: userId,
    title: `【デモ】${TITLES[i % TITLES.length]}`,
    why: pick(WHY),
    interpretation: 'ここに暮らす人の必然を、痕跡から想像した。',
    self_reflection: Math.random() < 0.3 ? '自分の子ども時代の記憶と重なった。' : null,
    latitude: jitter(CENTER.lat, 500),
    longitude: jitter(CENTER.lng, 500),
    emotion_key: emotion,
    emotion_keys: emotionKeys,
    intensity,
    region: REGION,
    visibility: VISIBILITY,
    session_code: SESSION_CODE,
    want_revisit: Math.random() < 0.4,
    want_to_share: Math.random() < 0.5,
    category: pick(CATEGORIES),
    custom_tags: [pick(CUSTOM_TAG_POOL), pick(CUSTOM_TAG_POOL)],
    companion_tag: pick(COMPANION_TAGS),
    created_at: daysAgo(1 + Math.floor(Math.random() * 45), 8 + Math.floor(Math.random() * 12)),
  };
  if (hasPhoto) { row.photo_url = placeholderPhoto('📷', colorByValence); row.photo_urls = [row.photo_url]; }
  if (hasAudio) { row.audio_transcript = '(音声メモの文字起こしデモ) この場所に来ると、いつも同じことを思い出します。'; row.voice_relation = '本人の語り'; }
  if (isArchive) {
    row.trace_type = 'archive';
    row.archive_type = 'old_photo';
    row.is_past_memory = true;
    row.memory_date = `${2026 - (5 + Math.floor(Math.random() * 20))}-01-01`; // DB上のmemory_dateはdate型のためISO形式で入れる
    row.yomi = 'でもかきゅうしし';
    row.era_label = '昭和後期';
    row.source_ref = '家族のアルバムより（デモ）';
  }

  const { data, error } = await supabase.from('traces').insert(row).select('id, user_id, created_at').single();
  if (error) throw new Error(`traces insert失敗: ${error.message}`);
  return data;
}

async function main() {
  console.log('既存のデモ利用者を取得中...');
  const userIds = await getDemoUsers();
  console.log(`デモ利用者: ${userIds.length}人`);

  console.log('痕跡50件（写真・音声・アーカイブ項目・タグ・誰と、を含む）を追加投入中...');
  const traces = [];
  for (let i = 0; i < 50; i++) {
    const userId = userIds[i % userIds.length];
    traces.push(await insertTrace(userId, i));
  }

  console.log('共感リアクション・コメントを追加投入中...');
  const insertedComments = [];
  for (const trace of traces) {
    const reactorCount = 1 + Math.floor(Math.random() * 3);
    const reactors = userIds.filter((u) => u !== trace.user_id).sort(() => Math.random() - 0.5).slice(0, reactorCount);
    for (const reactorId of reactors) {
      const reactionType = pick(['empathy', 'want_to_walk', 'natsukashii']);
      const { error } = await supabase.from('trace_reactions').insert({ trace_id: trace.id, user_id: reactorId, reaction_type: reactionType });
      if (!error) tally();
    }
    if (Math.random() < 0.5) {
      const commenter = pick(userIds.filter((u) => u !== trace.user_id));
      const { data, error } = await supabase.from('trace_comments')
        .insert({ trace_id: trace.id, user_id: commenter, body: pick(['わかります、この空気感。', 'いい景色ですね。', '自分も似た記憶があります。', 'ここ、今度行ってみます。']) })
        .select('id').single();
      if (!error && data) { insertedComments.push(data.id); tally(); }
    }
  }

  console.log('コメントへのリアクションを追加投入中...');
  for (const commentId of insertedComments) {
    if (Math.random() < 0.6) {
      const reactor = pick(userIds);
      const { error } = await supabase.from('comment_reactions').insert({ comment_id: commentId, user_id: reactor, reaction_type: 'like' });
      if (!error) tally();
    }
  }

  console.log('ブックマークを追加投入中...');
  for (let i = 0; i < 20; i++) {
    const user = pick(userIds);
    const trace = pick(traces);
    const { error } = await supabase.from('bookmarks').insert({ user_id: user, trace_id: trace.id });
    if (!error) tally();
  }

  console.log('フォロー関係を追加投入中...');
  const followPairs = new Set();
  let followCount = 0;
  while (followCount < 20) {
    const a = pick(userIds), b = pick(userIds);
    if (a === b) continue;
    const key = `${a}>${b}`;
    if (followPairs.has(key)) continue;
    followPairs.add(key);
    const { error } = await supabase.from('follows').insert({ follower_id: a, followee_id: b });
    if (!error) { followCount++; tally(); }
  }

  console.log('ダイレクトメッセージ（相互フォローの相手にのみ）を追加投入中...');
  // 相互フォローのペアを抽出
  const mutualPairs = [];
  for (const key of followPairs) {
    const [a, b] = key.split('>');
    if (followPairs.has(`${b}>${a}`) && !mutualPairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
      mutualPairs.push([a, b]);
    }
  }
  const dmBodies = ['先日の痕跡、拝見しました。', 'あの場所、今度一緒に歩いてみませんか。', 'コメントありがとうございました。', 'また何か見つけたら教えてください。'];
  for (const [a, b] of mutualPairs.slice(0, 15)) {
    const { error } = await supabase.from('direct_messages').insert({ sender_id: a, recipient_id: b, body: pick(dmBodies) });
    if (!error) tally();
  }

  console.log('会いたい申請（pending/declinedを追加）を投入中...');
  for (let i = 0; i < 10; i++) {
    const requester = pick(userIds), requestee = pick(userIds.filter((u) => u !== requester));
    const status = i < 5 ? 'pending' : 'declined';
    const { error } = await supabase.from('appointment_requests').insert({
      requester_id: requester, requestee_id: requestee, trace_id: pick(traces).id,
      purpose: 'この場所についてもっと話を聞いてみたい',
      status, responded_at: status === 'declined' ? daysAgo(Math.floor(Math.random() * 5)) : null,
    });
    if (!error) tally();
  }

  console.log('通報（trace_reports、レビュー機能のデモ）を投入中...');
  for (let i = 0; i < 3; i++) {
    const { error } = await supabase.from('trace_reports').insert({
      trace_id: pick(traces).id,
      reporter_id: pick(userIds),
      reason: pick(['個人が特定できそう', '内容が不適切かも', 'その他']),
      note: '【デモ】通報機能の動作確認用サンプルです。',
    });
    if (!error) tally();
  }

  console.log('通常のおすすめルート（イベント外）を投入中...');
  const { data: route, error: routeError } = await supabase.from('routes').insert({
    title: '【デモ】デモ架空市 裏路地めぐりルート',
    description: '営業デモ用の架空ルート。写真ピン・タグ・感情の重なりを見せるために作成。',
    trace_ids: traces.slice(0, 6).map((t) => t.id),
    user_id: userIds[0],
    session_code: SESSION_CODE,
    is_public_recommendation: true,
    review_status: 'approved',
    highlights: '静かな路地に残る、暮らしの痕跡を辿るルート。',
  }).select('id').single();
  if (routeError) throw new Error(`routes insert失敗: ${routeError.message}`);
  tally();

  console.log('ルート踏破記録を投入中...');
  for (let i = 0; i < 10; i++) {
    const user = pick(userIds);
    const { error } = await supabase.from('route_completions').insert({ route_id: route.id, user_id: user });
    if (!error) tally();
  }

  console.log('\n=== 完了 ===');
  console.log(`追加した痕跡: ${traces.length}件`);
  console.log(`追加したその他の作業（反応・コメント・ブックマーク・フォロー・DM・申請・通報・ルート踏破 等）: ${actionCount}件`);
  console.log(`合計の新規レコード: ${traces.length + actionCount}件`);
  console.log('すべて visibility=private のため、運営ダッシュボード（service-role経由）以外からは見えません。');
  console.log('\n削除する場合は: node scripts/cleanup-demo-sales-data.mjs（session_code一致分をまとめて削除）');
}

main().catch((err) => {
  console.error('失敗:', err.message);
  process.exit(1);
});
