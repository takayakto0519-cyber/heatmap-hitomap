// AI成果物（ai_deliverables）の語彙と、承認時にどの実体テーブルへ反映するかの対応表。
// APIルートとUIの両方から参照する単一の真実の源。
// 新しい kind を足すときは KINDS と REFLECT_TO の両方に追記すること
// （REFLECT_TO に無い kind は「反映先なし＝承認しても記録だけ」の扱いになる）。

export const KINDS = [
  'email_draft', 'followup_draft', 'reply_draft', 'evidence', 'contact',
  'requirements', 'mvp_content', 'quote_research', 'sns_post', 'biz_hypothesis',
  'validation_research', 'mvp_spec', 'content_theme',
] as const;
export type DeliverableKind = typeof KINDS[number];

export const STATUSES = ['proposed', 'approved', 'revise', 'archived'] as const;
export type DeliverableStatus = typeof STATUSES[number];

export const KIND_LABEL: Record<DeliverableKind, string> = {
  email_draft: '提案メール下書き',
  followup_draft: 'フォロー文案',
  reply_draft: '返信への返答案',
  evidence: '調査（根拠まとめ）',
  contact: '宛先',
  requirements: '要件メモ',
  mvp_content: 'MVPデモ用の痕跡案',
  quote_research: '見積のための競合調査',
  sns_post: 'SNS投稿案',
  biz_hypothesis: '新規事業の仮説',
  validation_research: '需要検証',
  mvp_spec: 'MVP仕様書',
  content_theme: 'SNS企画テーマ',
};

/**
 * 承認されたとき、成果物の body を実体テーブルのどのカラムに書き戻すか。
 * table は Supabase のテーブル名、column は書き戻し先。
 * ここに無い kind は実体への反映を行わない（成果物として残るだけ）。
 *
 * 【意図的に含めないもの】
 * - fact_check_status … 事実確認の判定は会長のボタンのみ。AIの成果物では動かさない
 *   （agents/fact_check_watch.py に明文化された誤判定事故の教訓）。
 * - email_sent_at … 送信は必ず会長の手で行う（憲法：AIの自律的外部送信の禁止）。
 * - traces … MVP痕跡の投入は公開を伴うので、専用の確認導線を通す。
 */
export const REFLECT_TO: Partial<Record<DeliverableKind, { table: string; column: string }>> = {
  email_draft: { table: 'municipality_profiles', column: 'email_draft' },
  followup_draft: { table: 'municipality_profiles', column: 'email_draft' },
  reply_draft: { table: 'municipality_profiles', column: 'email_draft' },
  evidence: { table: 'municipality_profiles', column: 'evidence_summary' },
  contact: { table: 'municipality_profiles', column: 'contact_email' },
  requirements: { table: 'municipality_profiles', column: 'requirements_memo' },
  validation_research: { table: 'biz_model_ideas', column: 'validation_summary' },
  mvp_spec: { table: 'biz_model_ideas', column: 'mvp_spec_md' },
  // content_theme は反映先を持たない（承認＝会長がテーマにゴーサインを出しただけの記録。
  // 次のsns_post生成でオートパイロットがこの承認済みテーマ本文を読みに行く）。
};

/**
 * REFLECT_TO は「既にある行を更新する」kind 用（entity_idが必須）。
 * こちらは対象の行が無い＝AIが新しく作った提案そのものを新規行として書き込む kind 用
 * （新規事業の仮説・SNS投稿案は、どの自治体・どのリードにも紐づかない独立した提案のため）。
 * [id]/route.ts は entity_id が無い成果物を承認したとき、こちらを使ってINSERTする。
 */
export const CREATE_IN: Partial<Record<DeliverableKind, {
  table: string;
  build: (d: { title: string; body: string }) => Record<string, unknown>;
}>> = {
  // 新規事業の登録先は必ずbiz_model_ideas（strategy_proposalsに新規事業カテゴリを
  // 重複登録しない——2026-07-23、登録先が2系統に分かれ見落とした反省。
  // .claude/skills/new-biz-hypothesis/SKILL.md に明記）。
  biz_hypothesis: {
    table: 'biz_model_ideas',
    build: d => ({ title: d.title, memo: d.body, status: 'idea' }),
  },
  sns_post: {
    table: 'sns_drafts',
    build: d => ({ platform: 'instagram', title: d.title, caption: d.body, status: 'draft' }),
  },
};

export function isKind(v: unknown): v is DeliverableKind {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v);
}
export function isStatus(v: unknown): v is DeliverableStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}
