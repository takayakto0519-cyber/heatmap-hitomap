// ============================================================
// ヒトマップ MVP : 投稿データの型定義
// DB(traces) と フォーム入力 と API I/O を一貫させる
// ============================================================

/** DBに保存される痕跡レコード（traces テーブルと1:1） */
export interface Trace {
  id: string;
  created_at: string; // ISO8601

  photo_url: string | null;

  latitude: number;
  longitude: number;

  title: string;
  why: string | null;             // なぜ気になったか
  interpretation: string | null;  // どんな暮らしが見えたか
  self_reflection: string | null; // 自分の記憶・感情とどうつながったか

  want_revisit: boolean;          // もう一度来たいか
  want_to_share: boolean;         // 誰かに話したいか

  // ヒートマップに使う感情データ
  emotion_key: string | null;     // 感情タグ（lib/emotions.ts の key）
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

  session_code: string | null;    // 実験回の識別
  nickname: string | null;        // 任意ニックネーム（匿名可）

  // アカウント・公開範囲・削除
  user_id: string | null;         // ログイン投稿の場合の auth.users.id（匿名投稿は null）
  visibility: string;             // private | followers | pending_review | public
  is_deleted: boolean;            // ソフトデリートフラグ
  deleted_at: string | null;
  deleted_by: string | null;      // 'admin' または削除者の識別子

  region: string | null;          // 逆ジオコーディングで自動保存される自治体名（例：「大阪府浪速区」）
}

/**
 * 投稿フォーム / 外部フォーム(Googleフォーム等)から受け取る入力。
 * id・created_at はサーバー側で採番するため含めない。
 * 写真は別途アップロード後に photo_url を確定させる。
 */
export interface TraceInput {
  photo_url?: string | null;

  latitude: number;
  longitude: number;

  title: string;
  why?: string;
  interpretation?: string;
  self_reflection?: string;

  want_revisit?: boolean;
  want_to_share?: boolean;

  emotion_key?: string | null;
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

  session_code?: string;
  nickname?: string;

  visibility?: string;             // private | followers | pending_review | public（未指定・未ログインは public 固定）
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
