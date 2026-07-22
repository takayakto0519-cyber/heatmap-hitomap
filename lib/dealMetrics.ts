// 商流の金額まわりを計算する純粋関数群。
// これまで案件（business_cases）はステージだけを持ち金額が無かったため、
// パイプライン総額・期待値・受注率・入金予定がダッシュボードのどこからも計算できなかった。
// lib/salesScore.ts・lib/followUp.ts と同じ「基準はコードに1箇所だけ」の思想で、
// FlowBoard・SalesKpiRow・MoneyWorkspace・Overviewの全てがここを参照する。

export type CaseStage =
  | '発案' | 'リード' | '提案' | '承認待ち' | '送信済み'
  | '受注' | '見送り' | '制作' | '納品' | '請求' | 'フォロー';

// 商流の正順（FlowBoardの「次へ→」ボタンはこの並びを1つ進める）。「見送り」は正順の外にある例外ステージ。
export const CASE_STAGE_ORDER: CaseStage[] = [
  '発案', 'リード', '提案', '承認待ち', '送信済み', '受注', '制作', '納品', '請求', 'フォロー',
];
export const CASE_STAGES: CaseStage[] = [...CASE_STAGE_ORDER, '見送り'];

export function nextStage(stage: string): CaseStage | null {
  const idx = CASE_STAGE_ORDER.indexOf(stage as CaseStage);
  if (idx === -1 || idx === CASE_STAGE_ORDER.length - 1) return null;
  return CASE_STAGE_ORDER[idx + 1];
}

// 受注に至る前（まだ結果が出ていない）ステージ。パイプライン総額の対象。
export const OPEN_STAGES: CaseStage[] = ['発案', 'リード', '提案', '承認待ち', '送信済み'];
// 受注が確定した後のステージ（受注そのものも含む）。
export const WON_STAGES: CaseStage[] = ['受注', '制作', '納品', '請求', 'フォロー'];

export interface DealCase {
  id: string;
  stage: string;
  amount: number | null;
  probability: number | null;
  expected_close_date: string | null;
  won_at: string | null;
  lost_reason: string | null;
  invoice_sent_at: string | null;
  payment_due: string | null;
  paid_at: string | null;
  last_contact_at: string | null;
  org_name: string;
}

export interface PipelineSummary {
  openCount: number;
  pipelineTotal: number;   // Σamount（オープン段階）
  expectedValue: number;   // Σamount×probability/100（オープン段階）
}

export function computePipelineSummary(cases: DealCase[]): PipelineSummary {
  const open = cases.filter((c) => OPEN_STAGES.includes(c.stage as CaseStage));
  let pipelineTotal = 0;
  let expectedValue = 0;
  for (const c of open) {
    const amount = c.amount ?? 0;
    pipelineTotal += amount;
    expectedValue += amount * ((c.probability ?? 50) / 100);
  }
  return { openCount: open.length, pipelineTotal, expectedValue: Math.round(expectedValue) };
}

export interface WinRate {
  won: number;
  lost: number;
  rate: number | null; // 母数が0ならnull（%表示側で「まだ判定できません」に出し分ける）
}

export function computeWinRate(cases: DealCase[]): WinRate {
  const won = cases.filter((c) => WON_STAGES.includes(c.stage as CaseStage) || c.won_at).length;
  const lost = cases.filter((c) => c.stage === '見送り').length;
  const total = won + lost;
  return { won, lost, rate: total > 0 ? Math.round((won / total) * 1000) / 10 : null };
}

export interface CashflowRow {
  id: string;
  org_name: string;
  amount: number;
  payment_due: string | null;
  overdue: boolean;
}

export interface CashflowSummary {
  unpaid: CashflowRow[];       // payment_due昇順（期日未設定は末尾）
  unpaidTotal: number;
  overdueTotal: number;
  paidThisMonth: number;       // paid_atが今月のamount合計
  wonThisMonth: number;        // won_atが今月のamount合計（今月の受注額）
}

function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function computeCashflow(cases: DealCase[], today: Date = new Date()): CashflowSummary {
  const unpaidCases = cases.filter((c) => c.invoice_sent_at && !c.paid_at);
  const unpaid: CashflowRow[] = unpaidCases
    .map((c) => ({
      id: c.id, org_name: c.org_name, amount: c.amount ?? 0, payment_due: c.payment_due,
      overdue: Boolean(c.payment_due && new Date(c.payment_due).getTime() < today.getTime()),
    }))
    .sort((a, b) => {
      if (!a.payment_due) return 1;
      if (!b.payment_due) return -1;
      return a.payment_due.localeCompare(b.payment_due);
    });

  const unpaidTotal = unpaid.reduce((sum, r) => sum + r.amount, 0);
  const overdueTotal = unpaid.filter((r) => r.overdue).reduce((sum, r) => sum + r.amount, 0);
  const paidThisMonth = cases
    .filter((c) => c.paid_at && isSameMonth(c.paid_at, today))
    .reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const wonThisMonth = cases
    .filter((c) => c.won_at && isSameMonth(c.won_at, today))
    .reduce((sum, c) => sum + (c.amount ?? 0), 0);

  return { unpaid, unpaidTotal, overdueTotal, paidThisMonth, wonThisMonth };
}

// ---- 返信率（sales_email_targets / municipality_profiles / client_leads 共通） ----
export interface OutreachRow {
  sent: boolean;          // 送信済みかどうか（sales_email_targets.sent、または email_sent_at != null）
  replied: boolean;       // 返信ありかどうか
}

export interface ReplyRate {
  sent: number;
  replied: number;
  rate: number | null; // %（母数0ならnull）
}

export function computeReplyRate(rows: OutreachRow[]): ReplyRate {
  const sent = rows.filter((r) => r.sent).length;
  const replied = rows.filter((r) => r.sent && r.replied).length;
  return { sent, replied, rate: sent > 0 ? Math.round((replied / sent) * 1000) / 10 : null };
}

// ---- MRR（顧問先の月額合計。SalesTabにあった計算をここへ移し、MoneyWorkspaceと共有する） ----
export interface DossierForMrr {
  monthly_fee: number | null;
  is_active?: boolean | null; // 未設定（既存データ）は「解約していない」とみなしtrue扱い
}

export function computeMrr(dossiers: DossierForMrr[]): number {
  return dossiers
    .filter((d) => d.is_active !== false)
    .reduce((sum, d) => sum + (d.monthly_fee ?? 0), 0);
}

// ---- 次アクションの既定文（迷わない導線の核。next_actionが空のときだけ薄字で提示する） ----
export function nextActionForStage(stage: string): string {
  switch (stage as CaseStage) {
    case '発案': return '証拠パックを固めて「リード」へ';
    case 'リード': return '最初の接触（メール/電話）をする';
    case '提案': return '提案書を作成し、リンクを貼る';
    case '承認待ち': return '提案書を先方に送付する（送信済みへ）';
    case '送信済み': return '返信を待つ／期日が近ければフォロー連絡';
    case '受注': return '契約書・請求書を準備する';
    case '制作': return '納期を確認し、制作を進める';
    case '納品': return '納品完了後、請求書を送付する（請求へ）';
    case '請求': return '入金を確認する';
    case 'フォロー': return '次回の接点（追加提案・紹介依頼）を決める';
    case '見送り': return '理由を記録し、時期を空けて再アプローチを検討';
    default: return '';
  }
}
