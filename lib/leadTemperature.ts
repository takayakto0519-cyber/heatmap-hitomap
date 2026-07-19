// ============================================================
// リード温度感スコアリング：agents/lead_temperature.py（番人4）と同じ
// ルールベースの加点式を、運営ダッシュボードの「学校・法人」タブから
// そのまま使えるようにしたもの（client_leads は既にそのタブで取得済みのため、
// 追加のSupabase読み取りは不要＝この関数はクライアント側でも呼べる純関数）。
// ============================================================

// 証拠パック(memo)に含まれると「熱い」とみなすキーワードと加点
export const HOT_WORDS: Record<string, number> = {
  '実証実験': 30, '既存': 25, '縁': 20, '関係': 12,
  '補助金': 18, '公募': 12, '総合計画': 12, '指針': 10,
  '人材不足': 10, '人材確保': 8, 'DX': 6, 'AI導入': 8,
  '拠点': 8, '地理的に一致': 10, '横浜': 6,
};

export interface LeadTemperature {
  score: number;
  temp: '🔥熱い' | '🌤ふつう' | '❄冷たい';
  reasons: string[];
}

export function scoreLead(lead: {
  memo?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
}): LeadTemperature {
  const memo = lead.memo ?? '';
  let score = 0;
  const reasons: string[] = [];

  for (const [word, points] of Object.entries(HOT_WORDS)) {
    if (memo.includes(word)) {
      score += points;
      reasons.push(word);
    }
  }
  if (lead.email || lead.phone) {
    score += 15;
    reasons.push('連絡先あり');
  }
  if (lead.status && ['contacted', 'negotiating', 'meeting', '商談中'].includes(lead.status)) {
    score += 20;
    reasons.push('進行中');
  }

  const temp = score >= 45 ? '🔥熱い' : score >= 20 ? '🌤ふつう' : '❄冷たい';
  return { score, temp, reasons };
}
