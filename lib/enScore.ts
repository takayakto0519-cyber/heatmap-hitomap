// ============================================================
// 縁スコア・エンジン — ヒトマップの核心方程式をそのまま営業に実装する。
//
//   出会い ＝ 【事実】×【共感】
//   縁   ＝（出会い）＋【一緒の行動】×【恩返し】
//
// 従来のファネル型CRM（候補→接触→商談→契約）は「相手を落とす」発想。
// ここでは相手ごとに 事実・共感・行動・恩返し の4要素を記録し（縁の台帳）、
// 方程式のどこが欠けているかから「次の一手」を機械的に導く。
// AI呼び出しは一切ない純関数（サーバー課金なし・クライアントでも動く）。
//
// もうひとつの原理：何もしないと縁は冷める。
// 最後の接点からの日数で鮮度が減衰する。
// ============================================================
import { HOT_WORDS } from '@/lib/leadTemperature';

export type EnKind = 'trace' | 'yohaku' | 'action' | 'suijo';

export const EN_KINDS: Record<EnKind, { label: string; icon: string; color: string; hint: string }> = {
  trace: { label: '事実', icon: '🔍', color: '#4A69BD', hint: '本当にあった事実。広報誌・求人票・総合計画・現場で見たものなど、嘘のない情報' },
  yohaku: { label: '共感', icon: '🌫', color: '#8E44AD', hint: '相手の困りごとと、こちらの強みが重なる一言。「〇〇に困っている。うちの〇〇が役に立つ」' },
  action: { label: '行動', icon: '🤝', color: '#E5A139', hint: '一緒に何かをすること。商談だけでなく、イベントへの同席・現場見学・一緒に調べ物をするなど' },
  suijo: { label: '恩返し', icon: '🎁', color: '#27AE60', hint: '見返りを求めずに渡したもの。または、相手からもらった感謝や紹介' },
};

export interface EnRecord {
  id: string;
  lead_id: string;
  kind: EnKind;
  note: string;
  happened_at: string; // date
  created_at: string;
}

export interface NextMove {
  key: string;
  title: string;
  why: string;   // 方程式上の理由
  how: string;   // 具体的な動き方
  priority: number; // 小さいほど先
}

export interface EnBreakdown {
  konseki: number;   // 0-10 事実
  yohaku: number;    // 0-10 共感
  deai: number;      // 0-100 出会い ＝ 事実×共感
  kyodo: number;     // 0-10 一緒の行動
  suijo: number;     // 0-10 恩返し
  en: number;        // 0-200 縁 ＝ 出会い ＋ 行動×恩返し
  daysSinceTouch: number;
  freshness: number; // 0.4-1.0 鮮度（放っておくと下がる）
  freshnessLabel: string;
  enLive: number;    // いまの縁の温度 ＝ 縁 × 鮮度
  stage: string;     // 方程式から導かれる現在地
  stageColor: string;
  nextMove: NextMove;
}

interface LeadLike {
  status?: string | null;
  memo?: string | null;
  email?: string | null;
  phone?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

function clamp10(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function daysBetween(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / 86400000);
}

// 最後に「手を動かした」日からの経過日数。台帳の記録とリード更新日の新しい方を採る
function daysSinceLastTouch(lead: LeadLike, records: EnRecord[], now: number): number {
  const candidates: number[] = [];
  if (lead.updated_at) candidates.push(daysBetween(lead.updated_at, now));
  for (const r of records) candidates.push(daysBetween(r.happened_at + 'T00:00:00', now));
  if (candidates.length === 0) return 999;
  return Math.max(0, Math.min(...candidates));
}

export function computeEn(lead: LeadLike, records: EnRecord[], now: number = Date.now()): EnBreakdown {
  const byKind = (k: EnKind) => records.filter(r => r.kind === k);
  const memo = lead.memo ?? '';

  // 事実：台帳の記録が主、証拠パック(memo)内の熱いキーワードと連絡先の有無が従
  let keywordPoints = 0;
  for (const [word, points] of Object.entries(HOT_WORDS)) {
    if (memo.includes(word)) keywordPoints += points;
  }
  const konseki = clamp10(
    Math.min(4, byKind('trace').length * 1.5) +
    Math.min(4, keywordPoints / 15) +
    ((lead.email || lead.phone) ? 1 : 0) +
    (memo.trim().length >= 80 ? 1 : 0)
  );

  // 共感：書かない限り0。1行書くことに意味がある
  const yohaku = clamp10(byKind('yohaku').length * 4);

  // 出会い ＝ 事実 × 共感（どちらかが0なら出会いは起きない、が方程式の主張）
  const deai = Math.round(konseki * yohaku);

  // 行動：記録が主、ステータスが従（商談中＝一緒の行動が始まっている兆し）
  const status = lead.status ?? 'lead';
  const kyodo = clamp10(
    byKind('action').length * 3 +
    (status === 'negotiating' ? 2 : status === 'contracted' ? 3 : 0)
  );

  // 恩返し：先に渡したこと・お礼や紹介をもらったこと
  const suijo = clamp10(byKind('suijo').length * 4);

  // 縁 ＝ 出会い ＋ 行動 × 恩返し
  const en = deai + Math.round(kyodo * suijo);

  // 鮮度：何もしないと縁は冷める。契約中は関係が続いているため下がり方を緩める
  const daysSinceTouch = daysSinceLastTouch(lead, records, now);
  const decayDays = status === 'contracted' ? daysSinceTouch / 2 : daysSinceTouch;
  const freshness = decayDays <= 7 ? 1.0 : decayDays <= 21 ? 0.85 : decayDays <= 45 ? 0.65 : 0.4;
  const freshnessLabel = freshness >= 1.0 ? '🔥 あたたかい' : freshness >= 0.85 ? '🌤 保たれている' : freshness >= 0.65 ? '🌙 冷めかけ' : '❄ 冷えている';

  const enLive = Math.round(en * freshness);

  // 現在地（ステージは手で選ぶものではなく、方程式から導かれる）
  let stage = 'まだ何もしていない'; let stageColor = '#999';
  if (status === 'lost') { stage = '見送り'; stageColor = '#E55039'; }
  else if (status === 'contracted') { stage = '縁（契約）'; stageColor = '#27AE60'; }
  else if (kyodo > 0 && suijo > 0) { stage = 'お互いさまの関係'; stageColor = '#27AE60'; }
  else if (kyodo > 0) { stage = '一緒に行動中'; stageColor = '#E5A139'; }
  else if (deai >= 20) { stage = '出会えたところ'; stageColor = '#8E44AD'; }
  else if (konseki > 0) { stage = '事実を集め中'; stageColor = '#4A69BD'; }

  return {
    konseki, yohaku, deai, kyodo, suijo, en,
    daysSinceTouch, freshness, freshnessLabel, enLive, stage, stageColor,
    nextMove: deriveNextMove({ status, konseki, yohaku, deai, kyodo, suijo, freshness, daysSinceTouch }),
  };
}

// 次の一手：方程式のどこが欠けているかで一意に決まる（迷わないことが自動化）
function deriveNextMove(s: {
  status: string; konseki: number; yohaku: number; deai: number;
  kyodo: number; suijo: number; freshness: number; daysSinceTouch: number;
}): NextMove {
  if (s.status === 'lost') {
    return {
      key: 'keep-thread', priority: 9, title: 'つながりを切らない',
      why: '見送りになっても、それで終わりではありません。事実は残っています',
      how: '台帳はそのまま残し、季節の便りや実績報告を年1回だけ届ける',
    };
  }
  if (s.konseki < 3) {
    return {
      key: 'gather-trace', priority: 1, title: '事実を集める',
      why: '知っている事実がまだ少ないです。事実と共感がそろって初めて出会いが生まれます',
      how: '広報誌・求人票・総合計画・SNSから、本当にあった事実を3つ見つけて記録に足す',
    };
  }
  if (s.yohaku === 0) {
    return {
      key: 'write-yohaku', priority: 2, title: '共感ポイントを書く',
      why: '事実は分かっているが、相手の困りごとと自社の強みが重なる部分がまだ言葉になっていません',
      how: '「〇〇に困っている。うちの〇〇が役に立つ」——この一言を書いてみる',
    };
  }
  if (s.kyodo === 0) {
    if (s.freshness <= 0.65) {
      return {
        key: 'rekindle', priority: 3, title: '連絡を絶やさない',
        why: `最後に連絡してから${s.daysSinceTouch}日たっています。出会えているのに、このままだと冷めてしまいます`,
        how: 'ひと言の便り（相手について知った事実への感想）を送り、小さな行動を一緒にすることを持ちかける',
      };
    }
    return {
      key: 'small-action', priority: 3, title: '小さな行動を一緒にする',
      why: '出会いはできています。次に進むには、一緒に何かをする機会が必要です',
      how: '商談だけで終わらせず、イベントへの同席・現場見学・一緒に調べ物をするなど、一緒に動く機会をひとつ作る',
    };
  }
  if (s.suijo === 0) {
    return {
      key: 'give-first', priority: 4, title: '先に何かを渡す',
      why: '一緒に行動していても、こちらから先に渡すものが無いと、深い関係にはなりにくいです',
      how: '見返りを求めず、役に立つものを先に渡す——地域のデータ、集計の一枚、誰かの紹介など',
    };
  }
  if (s.freshness <= 0.65) {
    return {
      key: 'rekindle', priority: 5, title: '連絡を絶やさない',
      why: `良い関係になりつつありますが、最後に連絡してから${s.daysSinceTouch}日たっています`,
      how: '近況ひと言＋相手に役立つ小ネタひとつ。長文は不要、気持ちが伝わればいい',
    };
  }
  if (s.status === 'contracted') {
    return {
      key: 'suijo-circle', priority: 7, title: '恩返しの輪を広げる',
      why: 'できた関係は、次の関係の入り口になります。紹介をお願いするのも恩返しの一つの形です',
      how: '「次の誰か」をご紹介いただく頼みごとをひとつ（/referral-request で下書きできます）',
    };
  }
  return {
    key: 'deepen', priority: 6, title: '関係をもっと深める',
    why: '必要な要素はそろっています。あとは一緒に行動し、お互いに渡し合うほど関係は強くなります',
    how: '次に一緒に行動する約束を取り付ける。契約の話はその場で自然に生まれる',
  };
}
