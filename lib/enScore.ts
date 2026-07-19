// ============================================================
// 縁スコア・エンジン — ヒトマップの核心方程式をそのまま営業に実装する。
//
//   出会い ＝ 【生きた証（痕跡）】×【自分を重ねる余白】
//   縁   ＝（出会い）＋【共に取り組む行動（共動）】×【互いの価値の承認（推譲）】
//
// 従来のファネル型CRM（候補→接触→商談→契約）は「相手を落とす」発想。
// ここでは相手ごとに 痕跡・余白・共動・推譲 の4要素を記録し（縁の台帳）、
// 方程式のどこが欠けているかから「次の一手」を機械的に導く。
// AI呼び出しは一切ない純関数（サーバー課金なし・クライアントでも動く）。
//
// もうひとつの原理：「行動の対義語は惰性」。縁は放置すると冷える。
// 最後の接点からの日数で鮮度が減衰する。
// ============================================================
import { HOT_WORDS } from '@/lib/leadTemperature';

export type EnKind = 'trace' | 'yohaku' | 'action' | 'suijo';

export const EN_KINDS: Record<EnKind, { label: string; icon: string; color: string; hint: string }> = {
  trace: { label: '痕跡', icon: '🔍', color: '#4A69BD', hint: '嘘のない事実。広報誌・求人票・総合計画・現場で見たモノから読み取った生きた証' },
  yohaku: { label: '余白', icon: '🌫', color: '#8E44AD', hint: '相手の痛みとヒトマップが重なる一行。「◯◯に困っている。うちの◯◯が重なる」' },
  action: { label: '共動', icon: '🤝', color: '#E5A139', hint: '身体的負荷を共有した行動。商談だけでなく、イベント同席・現場見学・一緒に痕跡集め' },
  suijo: { label: '推譲', icon: '🎁', color: '#27AE60', hint: '見返りを求めず譲ったもの／相手から承認・紹介されたこと' },
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
  konseki: number;   // 0-10 生きた証
  yohaku: number;    // 0-10 自分を重ねる余白
  deai: number;      // 0-100 出会い ＝ 痕跡×余白
  kyodo: number;     // 0-10 共に取り組む行動
  suijo: number;     // 0-10 互いの価値の承認
  en: number;        // 0-200 縁 ＝ 出会い ＋ 共動×推譲
  daysSinceTouch: number;
  freshness: number; // 0.4-1.0 鮮度（惰性で減衰）
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

  // 痕跡（生きた証）：台帳の痕跡記録が主、証拠パック(memo)内の熱いキーワードと連絡先の有無が従
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

  // 余白（自分を重ねる余白）：書かない限り0。1行書くことに意味がある
  const yohaku = clamp10(byKind('yohaku').length * 4);

  // 出会い ＝ 痕跡 × 余白（どちらかが0なら出会いは起きない、が方程式の主張）
  const deai = Math.round(konseki * yohaku);

  // 共動：記録が主、ステータスが従（商談中＝共動が始まっている兆し）
  const status = lead.status ?? 'lead';
  const kyodo = clamp10(
    byKind('action').length * 3 +
    (status === 'negotiating' ? 2 : status === 'contracted' ? 3 : 0)
  );

  // 推譲：先に譲ったこと・承認されたこと
  const suijo = clamp10(byKind('suijo').length * 4);

  // 縁 ＝ 出会い ＋ 共動 × 推譲
  const en = deai + Math.round(kyodo * suijo);

  // 鮮度：行動の対義語は惰性。契約中は関係が制度化されているため減衰を緩める
  const daysSinceTouch = daysSinceLastTouch(lead, records, now);
  const decayDays = status === 'contracted' ? daysSinceTouch / 2 : daysSinceTouch;
  const freshness = decayDays <= 7 ? 1.0 : decayDays <= 21 ? 0.85 : decayDays <= 45 ? 0.65 : 0.4;
  const freshnessLabel = freshness >= 1.0 ? '🔥 あたたかい' : freshness >= 0.85 ? '🌤 保たれている' : freshness >= 0.65 ? '🌙 冷めかけ' : '❄ 冷えている';

  const enLive = Math.round(en * freshness);

  // 現在地（ステージは手で選ぶものではなく、方程式から導かれる）
  let stage = '惰性（未着手）'; let stageColor = '#999';
  if (status === 'lost') { stage = '見送り'; stageColor = '#E55039'; }
  else if (status === 'contracted') { stage = '縁（契約）'; stageColor = '#27AE60'; }
  else if (kyodo > 0 && suijo > 0) { stage = '推譲の輪'; stageColor = '#27AE60'; }
  else if (kyodo > 0) { stage = '共動'; stageColor = '#E5A139'; }
  else if (deai >= 20) { stage = '出会いの入口'; stageColor = '#8E44AD'; }
  else if (konseki > 0) { stage = '痕跡集め'; stageColor = '#4A69BD'; }

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
      key: 'keep-thread', priority: 9, title: '糸は切らない',
      why: '見送りは縁の終わりではない。痕跡は残っている',
      how: '台帳はそのまま残し、季節の便りや実績報告を年1回だけ届ける',
    };
  }
  if (s.konseki < 3) {
    return {
      key: 'gather-trace', priority: 1, title: '痕跡を集める',
      why: '生きた証が薄い。痕跡×余白＝出会い——痕跡が0なら出会いは起きない',
      how: '広報誌・求人票・総合計画・SNSから「嘘のない事実」を3つ、台帳の🔍痕跡に書き足す',
    };
  }
  if (s.yohaku === 0) {
    return {
      key: 'write-yohaku', priority: 2, title: '余白を書く',
      why: '痕跡はあるが、相手が自分を重ねる余白がまだ言葉になっていない',
      how: '「◯◯に困っている。ヒトマップの◯◯がそこに重なる」——この一行を🌫余白に書く',
    };
  }
  if (s.kyodo === 0) {
    if (s.freshness <= 0.65) {
      return {
        key: 'rekindle', priority: 3, title: '火を絶やさない',
        why: `最後の接点から${s.daysSinceTouch}日。出会いの入口まで来たのに惰性で冷えている`,
        how: 'ひと言の便り（相手の痕跡に触れた感想）を送り、小さな共動をひとつ持ちかける',
      };
    }
    return {
      key: 'small-action', priority: 3, title: '小さな共動を仕掛ける',
      why: '出会いは成立している。縁に進むには「共に取り組む行動」の項が要る',
      how: '会うだけの商談ではなく、身体的負荷の共有をひとつ——イベント同席・現場見学・一緒に痕跡集め',
    };
  }
  if (s.suijo === 0) {
    return {
      key: 'give-first', priority: 4, title: '先に譲る（推譲）',
      why: '共動×推譲は掛け算。推譲が0のままでは共動が縁に化けない',
      how: '見返りを求めず役に立つものをひとつ渡す——地域の痕跡データ・集計の一枚・誰かの紹介',
    };
  }
  if (s.freshness <= 0.65) {
    return {
      key: 'rekindle', priority: 5, title: '火を絶やさない',
      why: `縁は結ばれつつあるが、最後の接点から${s.daysSinceTouch}日。惰性は縁を冷やす`,
      how: '近況ひと言＋相手に役立つ小ネタひとつ。長文は不要、体温が伝わればいい',
    };
  }
  if (s.status === 'contracted') {
    return {
      key: 'suijo-circle', priority: 7, title: '推譲の輪を広げる',
      why: '結ばれた縁は次の縁の親。紹介は最も安い新規獲得ではなく、推譲の実践',
      how: '「次の誰か」をご紹介いただく頼みごとをひとつ（/referral-request で下書きできます）',
    };
  }
  return {
    key: 'deepen', priority: 6, title: '縁を深めてもう一巡',
    why: '方程式の全項が立っている。あとは共動と推譲を重ねるほど縁は太くなる',
    how: '次の共動の約束を取り付ける。契約の話はその場で自然に生まれる',
  };
}
