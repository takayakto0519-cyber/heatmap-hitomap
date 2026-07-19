// GET /api/admin/agent-status — ローカルAIエージェント（agents/*.py、Windowsタスクスケジューラ登録）の
// 稼働状況を運営ダッシュボードに統合するための読み取り専用API。
// agent-dashboard/server.py（ヒトマップビルUI）が読んでいるのと同じ agents/work/*.json をNode fsで直接読む。
// ※ agents/ ディレクトリはこのPC（会長の開発機）だけに存在するローカルファイルのため、
//   hitomap.com（本番・Vercel等）からアクセスした場合はローカルファイルが無く local:false を返す。
//   会長がこのPC上で `npm run dev` してアクセスしたときだけ実データが見える設計。
//
// フロア定義・エージェント一覧・空きオフィス一覧は agent-dashboard/server.py が一次情報源。
// あちらに新しい番人を追加したら、この配列にも同じ内容を追記すること（command_center.pyのAGENT_METAと同様の運用）。
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const FLOORS = [
  { id: 'exec', name: '社長室', emoji: '👑', order: 0 },
  { id: 'A', name: '組織運営・秘書', emoji: '🗂️', order: 1 },
  { id: 'B', name: 'マーケティング・営業', emoji: '📣', order: 2 },
  { id: 'C', name: 'コンテンツ・広報', emoji: '🦊', order: 3 },
  { id: 'D', name: 'プロダクト運用', emoji: '🛠️', order: 4 },
  { id: 'E', name: 'コミュニティ運営', emoji: '🤝', order: 5 },
  { id: 'F', name: 'HR・採用インターン', emoji: '🎓', order: 6 },
  { id: 'G', name: '自治体・観光(B2G)', emoji: '🏯', order: 7 },
  { id: 'H', name: '財務・投資（moomooエンジン室）', emoji: '💰', order: 8 },
  { id: 'I', name: 'データ・分析R&D', emoji: '📊', order: 9 },
  { id: 'J', name: '新規事業探索', emoji: '🌱', order: 10 },
  { id: 'K', name: '学生課題支援', emoji: '📚', order: 11 },
];

const LOCAL_AGENTS: { id: string; name: string; emoji: string; floor: string; schedule: string }[] = [
  { id: 'approval_watch', name: '3. 06番地滞留監視', emoji: '🐹', floor: 'A', schedule: '毎日 08:00' },
  { id: 'report_screen', name: '19. 通報一次スクリーニングAI', emoji: '🦫', floor: 'D', schedule: '毎日 07:30' },
  { id: 'trace_qa', name: '22. データ整合性夜間QA番人', emoji: '🦔', floor: 'D', schedule: '毎日 02:00' },
  { id: 'deadline_watch', name: '54. 課題締切トラッキングAI', emoji: '🐰', floor: 'K', schedule: '毎日 07:00' },
  { id: 'spam_detect', name: '23. 不正投稿検知AI', emoji: '🐝', floor: 'D', schedule: '毎日 03:00' },
  { id: 'news_digest', name: '60. 今日のニュース抽出AI', emoji: '🐦', floor: 'B', schedule: '8時間ごと（06:30起点）' },
  { id: 'financial_snapshot', name: '42. 財務・事業ダッシュボードAI要約', emoji: '🐷', floor: 'H', schedule: '毎日 07:45' },
  { id: 'case_pipeline_watch', name: '8. 案件パイプライン番人', emoji: '🐿️', floor: 'B', schedule: '毎日 08:15' },
  { id: 'revenue_initiative_watch', name: '収益化イニシアチブ番人', emoji: '🐸', floor: 'J', schedule: '毎日 08:30' },
  { id: 'office_diary', name: '101. ビル日報AI', emoji: '🐤', floor: 'A', schedule: '毎日 09:15' },
  { id: 'lead_temperature', name: '4. リード温度感スコアリングAI', emoji: '🐧', floor: 'B', schedule: '毎日 08:45' },
  { id: 'payment_watch', name: '6. 入金照合番人', emoji: '🐮', floor: 'H', schedule: '毎日 08:50' },
  { id: 'lost_deal_archive', name: '10. 失注理由アーカイブAI', emoji: '🐋', floor: 'B', schedule: '毎週月 09:00' },
  { id: 'schedule_watch', name: '25. スケジュール番人', emoji: '🐈', floor: 'A', schedule: '毎日 07:15' },
  { id: 'burnout_watch', name: '27. 燃え尽き検知番人', emoji: '🐨', floor: 'A', schedule: '毎日 21:00' },
  { id: 'line_mission', name: 'LINE縁ミッション生成', emoji: '🐇', floor: 'E', schedule: '毎日確認（2週に一度発火）' },
  { id: 'email_queue', name: '営業メール下書きキュー', emoji: '🐢', floor: 'B', schedule: '毎日 08:35' },
  { id: 'trace_pattern', name: '62. 痕跡データパターン分析AI', emoji: '🦩', floor: 'I', schedule: '毎日 02:30' },
  { id: 'relation_population', name: '63. 関係人口ダッシュボードAI', emoji: '🦚', floor: 'G', schedule: '毎日 02:40' },
  { id: 'calendar_watch', name: '29. カレンダー番人', emoji: '🦉', floor: 'A', schedule: '毎日 06:50' },
  { id: 'competitor_market_research', name: '9. 競合・市場調査エージェント', emoji: '🦫', floor: 'B', schedule: '毎日 06:00' },
  { id: 'marketing_digest', name: 'マーケティング日報', emoji: '🦔', floor: 'B', schedule: '毎日 08:40' },
  { id: 'competitor_feature_monitor', name: '42. 競合プロダクト機能差分モニタAI', emoji: '🦎', floor: 'I', schedule: '毎日 06:10' },
  { id: 'ab_test_summary_watch', name: '79. UI改善A/Bテスト自動集計AI', emoji: '🐁', floor: 'I', schedule: '毎日 03:10' },
  { id: 'command_center', name: '80. 統合司令室AI', emoji: '🦅', floor: 'I', schedule: '毎日 09:30' },
  { id: 'new_biz_signal_watch', name: '50. 新規事業仮説の種探しAI', emoji: '🐣', floor: 'J', schedule: '毎日 05:40' },
  { id: 'global_market_watch', name: '51. 海外展開リサーチAI', emoji: '🦜', floor: 'J', schedule: '毎日 06:20' },
  { id: 'academic_partnership_watch', name: '52. 産学連携リサーチAI', emoji: '🦉', floor: 'J', schedule: '毎日 06:30' },
  { id: 'memorial_anniversary_watch', name: '53. 周年史アーカイブAI', emoji: '🕊️', floor: 'J', schedule: '毎日 07:05' },
];

const VACANT_AGENTS: { floor: string; num: number; name: string }[] = [
  { floor: 'A', num: 5, name: '意思決定ログ検索AI' },
  { floor: 'C', num: 13, name: 'X/Note下書きAI' }, { floor: 'C', num: 15, name: '痕跡ストーリー化AI' },
  { floor: 'C', num: 16, name: '共鳴分析AI' }, { floor: 'C', num: 17, name: '採用PR動画構成案AI' }, { floor: 'C', num: 18, name: 'メディア言及モニタAI' },
  { floor: 'D', num: 20, name: 'スポンサー・自治体トリアージAI' },
  { floor: 'D', num: 21, name: 'イベント公開前チェックAI' },
  { floor: 'D', num: 24, name: 'オンボーディング離脱分析AI' },
  { floor: 'E', num: 25, name: 'ホスト伴走AI' }, { floor: 'E', num: 26, name: '参加者共鳴マッチングAI' },
  { floor: 'E', num: 27, name: 'コミュニティ健全性番人' }, { floor: 'E', num: 28, name: '推譲サイクル可視化AI' },
  { floor: 'E', num: 29, name: '離脱予兆検知AI' },
  { floor: 'F', num: 30, name: '社員トレーディングカード自動生成AI' }, { floor: 'F', num: 31, name: 'インターン参加者事前マッチングAI' },
  { floor: 'F', num: 32, name: '4フェーズ進行管理AI' }, { floor: 'F', num: 33, name: '痕跡解読トレーニングAI' },
  { floor: 'F', num: 34, name: 'OB/OGネットワークAI' },
  { floor: 'G', num: 38, name: 'デジタル観光大使AIナビゲーター' },
  { floor: 'G', num: 39, name: '学校遠足安全管理AI' },
  { floor: 'H', num: 43, name: '投資リターン追跡・リバランス提案AI' },
  { floor: 'H', num: 44, name: '事業別採算モニタAI' }, { floor: 'H', num: 45, name: '助成金・補助金スキャンAI' },
  { floor: 'K', num: 55, name: '文献収集AI' },
  { floor: 'K', num: 56, name: '参考文献フォーマッターAI' }, { floor: 'K', num: 57, name: '授業ノート構造化AI' },
  { floor: 'K', num: 58, name: 'レポート骨子AI' }, { floor: 'K', num: 59, name: 'ゼミ・グループ課題進捗トラッカーAI' },
];

function xpToLevel(total: number) {
  return { level: 1 + Math.floor(total / 5), xp: total, into: total % 5, need: 5 };
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const workDir = path.join(process.cwd(), 'agents', 'work');
  if (!fs.existsSync(workDir)) {
    return NextResponse.json({ ok: true, local: false, floors: FLOORS, vacant: VACANT_AGENTS });
  }

  const xp = readJson(path.join(workDir, 'xp.json')) ?? {};

  const agents = LOCAL_AGENTS.map(meta => {
    const flagPath = path.join(workDir, `${meta.id}.flag`);
    const resultPath = path.join(workDir, `${meta.id}.json`);
    const working = fs.existsSync(flagPath);
    const result = readJson(resultPath);
    const xpRec = (xp as Record<string, { total?: number }>)[meta.id] ?? {};
    const level = xpToLevel(Number(xpRec.total ?? 0));
    return {
      id: meta.id, name: meta.name, emoji: meta.emoji, floor: meta.floor, schedule: meta.schedule,
      status: working ? 'working' : 'resting',
      result,
      generatedAt: (result?.generated_at as string | undefined) ?? null,
      level: level.level, xp: level.xp,
    };
  });

  return NextResponse.json({ ok: true, local: true, floors: FLOORS, agents, vacant: VACANT_AGENTS });
}
