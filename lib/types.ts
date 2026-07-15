// ============================================================
// ヒトマップ MVP : 投稿データの型定義
// DB(traces) と フォーム入力 と API I/O を一貫させる
// ============================================================

/** DBに保存される痕跡レコード（traces テーブルと1:1） */
export interface Trace {
  id: string;
  created_at: string; // ISO8601

  photo_url: string | null;       // 先頭の1枚（一覧・ピン・OGP等の代表画像）
  photo_urls: string[] | null;    // 複数枚投稿（最大4枚、photo_urls[0] === photo_url）
  video_url: string | null;       // 短い動画（言い伝え・人の声の記録に効果的）

  latitude: number;
  longitude: number;

  title: string;
  why: string | null;             // なぜ気になったか
  interpretation: string | null;  // どんな暮らしが見えたか
  self_reflection: string | null; // 自分の記憶・感情とどうつながったか

  want_revisit: boolean;          // もう一度来たいか
  want_to_share: boolean;         // 誰かに話したいか

  // ヒートマップに使う感情データ
  emotion_key: string | null;     // 感情タグ（lib/emotions.ts の key）。複数選択時は先頭の1つ（ヒートマップ色・共鳴・クエスト判定の代表値）
  emotion_keys: string[] | null;  // 複数選択された感情タグ（emotion_keys[0] === emotion_key）
  intensity: number | null;       // 強度 1〜5（ヒートマップの熱量）

  category: string | null;        // 何に心が動いたか（建物・植物・道具など）

  trace_type: string | null;      // 人・もの・こと
  is_past_memory: boolean;        // 過去の記憶フラグ
  memory_date: string | null;     // いつの記憶か（ISO8601 date）
  custom_tags: string[] | null;   // カスタムタグ

  // 地域×アーカイブ（archive_type が null なら従来の痕跡投稿）
  archive_type: string | null;    // chimei | denshou | bunken | koe
  yomi: string | null;            // 地名の読み
  alt_names: string | null;       // 別名・旧称（カンマ区切り）
  era_label: string | null;       // 時代・年代（自由記述）
  source_ref: string | null;      // 文献の出典・URL
  voice_relation: string | null;  // resident | former_resident | visitor | heard
  audio_url: string | null;       // 言い伝え・人の声の録音
  audio_transcript: string | null; // 録音の文字起こし（手動入力）

  session_code: string | null;    // 実験回の識別
  nickname: string | null;        // 任意ニックネーム（匿名可）

  // アカウント・公開範囲・削除
  user_id: string | null;         // ログイン投稿の場合の auth.users.id（匿名投稿は null）
  visibility: string;             // private | followers | pending_review | public
  is_deleted: boolean;            // ソフトデリートフラグ
  deleted_at: string | null;
  deleted_by: string | null;      // 'admin' または削除者の識別子

  region: string | null;          // 逆ジオコーディングで自動保存される自治体名（例：「大阪府浪速区」）

  team: string | null;            // リレー型イベント参加時のチーム名（自由記述）

  revisit_of: string | null;      // 「その後」の記録：この痕跡がどの痕跡の後日談かを示す元の trace の id

  companion_tag: string | null;   // 誰と一緒に見つけたか（自由記述、任意）— 関係性データの最小記録
}

/**
 * 投稿フォーム / 外部フォーム(Googleフォーム等)から受け取る入力。
 * id・created_at はサーバー側で採番するため含めない。
 * 写真は別途アップロード後に photo_url を確定させる。
 */
export interface TraceInput {
  photo_url?: string | null;
  photo_urls?: string[] | null;
  video_url?: string | null;

  latitude: number;
  longitude: number;

  title: string;
  why?: string;
  interpretation?: string;
  self_reflection?: string;

  want_revisit?: boolean;
  want_to_share?: boolean;

  emotion_key?: string | null;
  emotion_keys?: string[] | null;
  intensity?: number | null;

  category?: string | null;

  trace_type?: string | null;
  is_past_memory?: boolean;
  memory_date?: string | null;
  custom_tags?: string[] | null;

  archive_type?: string | null;
  yomi?: string | null;
  alt_names?: string | null;
  era_label?: string | null;
  source_ref?: string | null;
  voice_relation?: string | null;
  audio_url?: string | null;
  audio_transcript?: string | null;

  session_code?: string;
  nickname?: string;
  team?: string;                   // リレー型イベント参加時のチーム名（指定するとvisibilityは強制的にpublic）

  visibility?: string;             // private | followers | pending_review | public（未指定・未ログインは public 固定）

  revisit_of?: string | null;      // 「その後」の記録として投稿する場合、元の trace の id

  companion_tag?: string | null;   // 誰と一緒に見つけたか（自由記述、任意）
}

// ------------------------------------------------------------
// API インターフェース
// 将来 Googleフォーム → Webhook → Supabase に流し込む際の受け口
// POST /api/traces  と  GET /api/traces  を想定
// ------------------------------------------------------------

/** POST /api/traces のリクエストボディ */
export type CreateTraceRequest = TraceInput;

/** POST /api/traces のレスポンス */
export interface CreateTraceResponse {
  ok: boolean;
  trace?: Trace;
  error?: string;
}

/** GET /api/traces のレスポンス（一覧 / マップ用） */
export interface ListTracesResponse {
  ok: boolean;
  traces: Trace[];
  error?: string;
}

/** GET /api/traces のクエリ（実験回での絞り込み） */
export interface ListTracesQuery {
  session_code?: string;
  limit?: number;
}

// ------------------------------------------------------------
// 痕跡ルート：複数の痕跡を順番につなげ「この人が歩いた道」として公開する
// ------------------------------------------------------------

export interface Route {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  trace_ids: string[];   // 順序付き。歩く順番＝配列の順番
  nickname: string | null;
  user_id: string | null;
  session_code: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  sponsor_name: string | null;  // 協賛企業名（手動設定、決済は伴わない）
  sponsor_url: string | null;

  // イベント専用ページ（/events/[event_slug]）。event_slugが入っている行だけが公開イベントとして扱われる
  event_slug: string | null;
  event_cover_url: string | null;
  event_starts_at: string | null;
  event_ends_at: string | null;
  event_area: string | null;
  event_mode: string;              // 'route'（事前ルート型） | 'relay'（発見連鎖型） | 'bonno'（煩悩オークション型）
  event_session_code: string | null; // relay型イベントの参加者投稿を束ねるsession_code

  // スタート・ゴール地点（relay型は投稿ルートが事前に決まっていないため、運営がピンだけ先に設定できるようにする）
  event_start_lat: number | null;
  event_start_lng: number | null;
  event_start_label: string | null;
  event_end_lat: number | null;
  event_end_lng: number | null;
  event_end_label: string | null;
  event_waypoints: { lat: number; lng: number; label: string }[] | null; // スタート→経由地点→ゴールの順で経路線を描くための中継地点

  event_fee: string | null;          // 参加費（自由記述。例：「無料」「500円（当日徴収）」）
  event_meeting_info: string | null; // 集合場所・持ち物・注意事項などの自由記述
  event_photo_urls: string[] | null; // イベント紹介用の複数枚写真（[0]がヒーロー画像として使われる）

  is_public_recommendation: boolean; // ログインユーザーが「おすすめルート」として公開申請したか
  review_status: string | null;      // null | 'pending' | 'approved' | 'rejected'（運営承認）
  highlights: string | null;         // 見どころ・おすすめポイント（自由記述）
}

export interface CreateRouteRequest {
  title: string;
  description?: string | null;
  trace_ids: string[];
  nickname?: string;
  session_code?: string;
  event_mode?: 'route' | 'relay';
  event_session_code?: string;
  is_public_recommendation?: boolean;
  highlights?: string;
}

export interface CreateRouteResponse {
  ok: boolean;
  route?: Route;
  error?: string;
}

/** GET /api/routes/[id] のレスポンス。traces は trace_ids の順番どおりに解決済み */
export interface RouteDetailResponse {
  ok: boolean;
  route?: Route;
  traces?: Trace[];
  error?: string;
}

export interface ListRoutesResponse {
  ok: boolean;
  routes: Route[];
  error?: string;
}

export interface RouteCompletionsResponse {
  ok: boolean;
  count: number;
  error?: string;
}

// ------------------------------------------------------------
// 煩悩オークション（event_mode='bonno'）：参加者が投稿した煩悩の短文。
// 会場の投影ウォール・運営コンソール・AI分析ダッシュボードで使う。
// ------------------------------------------------------------

export interface BonnoSubmission {
  id: string;
  event_slug: string;          // routes.event_slug と対応
  text: string;                // 煩悩本文（最大100字）
  nickname: string | null;
  status: 'visible' | 'hidden';
  featured_at: string | null;  // スポットライト指名時刻（NULL=非指名）
  intensity_score: number | null; // 1〜5 切実さ（AI分析で記入）
  ai_keywords: string[] | null;   // ワードクラウド用キーワード（AI分析で記入）
  analyzed_at: string | null;
  created_at: string;
}

// ------------------------------------------------------------
// 自治体向け集計API（Phase 1）：グリッド単位に集計し、しきい値未満のセルは
// 抑制する。個別トレースの緯度経度・写真・自由記述は一切含めない。
// ------------------------------------------------------------

export interface RegionAggregateCell {
  gridLat: number;   // グリッドの中心緯度（丸め済み。個別投稿の座標ではない）
  gridLng: number;
  count: number;
  valence: { positive: number; negative: number; neutral: number };
}

export interface RegionAggregateResponse {
  ok: boolean;
  region: string;
  generatedAt: string;
  gridSizeDeg: number;
  threshold: number;         // このしきい値未満の件数のセルは非表示（k-匿名性）
  totalPublicTraces: number; // しきい値適用前の region 全体の件数（既存のリード証拠パックと同じ粒度）
  suppressedCells: number;   // しきい値未満だったため非表示にしたセル数
  cells: RegionAggregateCell[];
  error?: string;
}

// ------------------------------------------------------------
// 顧客専用ダッシュボードアクセス（Phase 2）：Supabase Authのアカウントを
// 持たない自治体・法人顧客に、トークン付きURLで集計データだけを見せる。
// ------------------------------------------------------------

export interface DashboardAccess {
  id: string;
  client_lead_id: string | null;
  token: string;
  region: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  last_accessed_at: string | null;
}

export interface IssueDashboardTokenResponse {
  ok: boolean;
  access?: DashboardAccess;
  url?: string;
  error?: string;
}

export interface DashboardResponse {
  ok: boolean;
  label: string | null;
  aggregate?: RegionAggregateResponse;
  error?: string;
}

export interface Sponsor {
  id: string;
  placement: 'region' | 'detour';
  region: string | null;
  name: string;
  message: string | null;
  url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
}

export interface ListSponsorsResponse {
  ok: boolean;
  sponsors: Sponsor[];
  error?: string;
}

// ------------------------------------------------------------
// 痕跡へのコメント
// ------------------------------------------------------------

export interface TraceComment {
  id: string;
  created_at: string;
  trace_id: string;
  user_id: string;
  body: string;
  username: string | null;       // 投稿者のプロフィールから解決（表示用）
  display_name: string | null;
  avatar_url: string | null;
}

export interface ListCommentsResponse {
  ok: boolean;
  comments: TraceComment[];
  error?: string;
}

export interface CreateCommentResponse {
  ok: boolean;
  comment?: TraceComment;
  error?: string;
}

// ------------------------------------------------------------
// フォロワー間チャット（相互フォローの相手とのみ送受信可）
// ------------------------------------------------------------

export interface DirectMessage {
  id: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
}

export interface DmConversation {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  unreadCount: number;
}

export interface ListConversationsResponse {
  ok: boolean;
  conversations: DmConversation[];
  error?: string;
}

export interface ListMessagesResponse {
  ok: boolean;
  messages: DirectMessage[];
  isMutual: boolean;
  error?: string;
}

export interface SendMessageResponse {
  ok: boolean;
  message?: DirectMessage;
  error?: string;
}

/**
 * Googleフォームの回答行 → TraceInput への正規化マップ。
 * （Apps Script や中継サーバーで列名→キーを対応させる際の指針）
 */
export const GOOGLE_FORM_FIELD_MAP: Record<string, keyof TraceInput> = {
  '写真': 'photo_url',
  'タイトル': 'title',
  'なぜ気になったか': 'why',
  'どんな暮らしが見えたか': 'interpretation',
  '自分の記憶・感情とどうつながったか': 'self_reflection',
  'もう一度来たいか': 'want_revisit',
  '誰かに話したいか': 'want_to_share',
  '感情タグ': 'emotion_key',
  '強度': 'intensity',
  'ニックネーム': 'nickname',
};
