// ============================================================================
// AIエージェント名簿（単一の真実の源）— 番人(script)・スキル(skill)・未着工(vacant)を1箇所に集約。
// このファイルを更新したら `node scripts/export-agent-roster.mjs` を実行し、
// agents/roster.generated.json を再生成すること（Python側の番人が読む）。
//
// 三重管理していた FLOORS / LOCAL_AGENTS / VACANT_AGENTS を統合し、
// さらに .claude/skills/ の全スキルを名簿に載せて「ビルに何体居るか」を可視化する。
// 自動生成の初版だが、以後は手で編集してよい（scripts/gen は初回のみの補助）。
// ============================================================================

export type FloorId = 'exec' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'dev';
export type AgentKind = 'script' | 'skill' | 'vacant';

export interface Floor { id: FloorId; name: string; emoji: string; order: number; }
export interface AgentDef {
  id: string;
  name: string;
  emoji: string;
  floor: FloorId;
  kind: AgentKind;
  num?: number;        // ロードマップ番号（分かるもの）
  schedule?: string;   // script のみ
  invoke?: string;     // skill のみ（例 '/lead-scout'）
}

export const FLOORS: Floor[] = [
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
  { id: 'dev', name: '共通・開発ツール', emoji: '🧰', order: 12 },
];

// 番人（Pythonで自動実行・稼働状況に表示）
export const SCRIPTS: AgentDef[] = [
  { id: 'approval_watch', name: '3. 06番地滞留監視', emoji: '🐹', floor: 'A', kind: 'script', schedule: '毎日 08:00' },
  { id: 'report_screen', name: '19. 通報一次スクリーニングAI', emoji: '🦫', floor: 'D', kind: 'script', schedule: '毎日 07:30' },
  { id: 'trace_qa', name: '22. データ整合性夜間QA番人', emoji: '🦔', floor: 'D', kind: 'script', schedule: '毎日 02:00' },
  { id: 'deadline_watch', name: '54. 課題締切トラッキングAI', emoji: '🐰', floor: 'K', kind: 'script', schedule: '毎日 07:00' },
  { id: 'spam_detect', name: '23. 不正投稿検知AI', emoji: '🐝', floor: 'D', kind: 'script', schedule: '毎日 03:00' },
  { id: 'news_digest', name: '60. 今日のニュース抽出AI', emoji: '🐦', floor: 'B', kind: 'script', schedule: '8時間ごと（06:30起点）' },
  { id: 'financial_snapshot', name: '42. 財務・事業ダッシュボードAI要約', emoji: '🐷', floor: 'H', kind: 'script', schedule: '毎日 07:45' },
  { id: 'case_pipeline_watch', name: '8. 案件パイプライン番人', emoji: '🐿️', floor: 'B', kind: 'script', schedule: '毎日 08:15' },
  { id: 'revenue_initiative_watch', name: '収益化イニシアチブ番人', emoji: '🐸', floor: 'J', kind: 'script', schedule: '毎日 08:30' },
  { id: 'office_diary', name: '101. ビル日報AI', emoji: '🐤', floor: 'A', kind: 'script', schedule: '毎日 09:15' },
  { id: 'lead_temperature', name: '4. リード温度感スコアリングAI', emoji: '🐧', floor: 'B', kind: 'script', schedule: '毎日 08:45' },
  { id: 'payment_watch', name: '6. 入金照合番人', emoji: '🐮', floor: 'H', kind: 'script', schedule: '毎日 08:50' },
  { id: 'lost_deal_archive', name: '10. 失注理由アーカイブAI', emoji: '🐋', floor: 'B', kind: 'script', schedule: '毎週月 09:00' },
  { id: 'schedule_watch', name: '25. スケジュール番人', emoji: '🐈', floor: 'A', kind: 'script', schedule: '毎日 07:15' },
  { id: 'burnout_watch', name: '27. 燃え尽き検知番人', emoji: '🐨', floor: 'A', kind: 'script', schedule: '毎日 21:00' },
  { id: 'line_mission', name: 'LINE縁ミッション生成', emoji: '🐇', floor: 'E', kind: 'script', schedule: '毎日確認（2週に一度発火）' },
  { id: 'email_queue', name: '営業メール下書きキュー', emoji: '🐢', floor: 'B', kind: 'script', schedule: '毎日 08:35' },
  { id: 'trace_pattern', name: '62. 痕跡データパターン分析AI', emoji: '🦩', floor: 'I', kind: 'script', schedule: '毎日 02:30' },
  { id: 'relation_population', name: '63. 関係人口ダッシュボードAI', emoji: '🦚', floor: 'G', kind: 'script', schedule: '毎日 02:40' },
  { id: 'calendar_watch', name: '29. カレンダー番人', emoji: '🦉', floor: 'A', kind: 'script', schedule: '毎日 06:50' },
  { id: 'competitor_market_research', name: '9. 競合・市場調査エージェント', emoji: '🦫', floor: 'B', kind: 'script', schedule: '毎日 06:00' },
  { id: 'marketing_digest', name: 'マーケティング日報', emoji: '🦔', floor: 'B', kind: 'script', schedule: '毎日 08:40' },
  { id: 'competitor_feature_monitor', name: '42. 競合プロダクト機能差分モニタAI', emoji: '🦎', floor: 'I', kind: 'script', schedule: '毎日 06:10' },
  { id: 'ab_test_summary_watch', name: '79. UI改善A/Bテスト自動集計AI', emoji: '🐁', floor: 'I', kind: 'script', schedule: '毎日 03:10' },
  { id: 'command_center', name: '80. 統合司令室AI', emoji: '🦅', floor: 'I', kind: 'script', schedule: '毎日 09:30' },
  { id: 'new_biz_signal_watch', name: '50. 新規事業仮説の種探しAI', emoji: '🐣', floor: 'J', kind: 'script', schedule: '毎日 05:40' },
  { id: 'global_market_watch', name: '51. 海外展開リサーチAI', emoji: '🦜', floor: 'J', kind: 'script', schedule: '毎日 06:20' },
  { id: 'academic_partnership_watch', name: '52. 産学連携リサーチAI', emoji: '🦉', floor: 'J', kind: 'script', schedule: '毎日 06:30' },
  { id: 'memorial_anniversary_watch', name: '53. 周年史アーカイブAI', emoji: '🕊️', floor: 'J', kind: 'script', schedule: '毎日 07:05' },
  { id: 'action_items_digest', name: '作業状況ダッシュボード番人', emoji: '🐭', floor: 'A', kind: 'script', schedule: '毎日 08:20' },
  { id: 'revisit_prompt', name: '「その後」通知番人', emoji: '🦝', floor: 'E', kind: 'script', schedule: '毎日 09:00' },
  { id: 'gmail_watch', name: 'Gmail送受信番人', emoji: '📬', floor: 'B', kind: 'script', schedule: '毎日 07:10' },
];

// スキル（会話で起動・.claude/skills 配下）
export const SKILLS: AgentDef[] = [
  { id: 'ab-test-summary', name: 'UI改善A/Bテスト自動集計', emoji: '🧩', floor: 'I', kind: 'skill', invoke: '/ab-test-summary', num: 79 },
  { id: 'academic-partnership-research', name: '産学連携リサーチ', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/academic-partnership-research', num: 70 },
  { id: 'achievement-blog', name: '実績ブログ生成', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/achievement-blog' },
  { id: 'agent-status', name: 'ビル稼働レポート', emoji: '🧩', floor: 'I', kind: 'skill', invoke: '/agent-status' },
  { id: 'ai-policy-template', name: 'AI活用ルール雛形生成', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/ai-policy-template', num: 15 },
  { id: 'alumni-network', name: 'OB/OGネットワーク', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/alumni-network', num: 51 },
  { id: 'appointment-helper', name: 'アポ調整補助', emoji: '🧩', floor: 'A', kind: 'skill', invoke: '/appointment-helper', num: 12 },
  { id: 'approval-sweep', name: '承認待ち棚卸し', emoji: '🧩', floor: 'A', kind: 'skill', invoke: '/approval-sweep' },
  { id: 'attendee-followup', name: '受講者フォロー', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/attendee-followup', num: 45 },
  { id: 'backup-watch', name: 'バックアップ番人', emoji: '🧩', floor: 'I', kind: 'skill', invoke: '/backup-watch', num: 81 },
  { id: 'biz-line-pnl', name: '事業別採算モニタ', emoji: '🧩', floor: 'H', kind: 'skill', invoke: '/biz-line-pnl', num: 85 },
  { id: 'biz-memo', name: '戦略メモ清書', emoji: '🧩', floor: 'A', kind: 'skill', invoke: '/biz-memo' },
  { id: 'brainstorming', name: '実装前ブレスト', emoji: '🧩', floor: 'dev', kind: 'skill', invoke: '/brainstorming' },
  { id: 'card-followup', name: 'イベント名刺フォローアップ', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/card-followup', num: 8 },
  { id: 'case-pipeline', name: '案件パイプライン統括', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/case-pipeline' },
  { id: 'case-study-page', name: '事例ページ生成', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/case-study-page', num: 37 },
  { id: 'cashflow-forecast', name: 'キャッシュフロー予測番人', emoji: '🧩', floor: 'H', kind: 'skill', invoke: '/cashflow-forecast', num: 89 },
  { id: 'changelog-writer', name: '変更ログ生成', emoji: '🧩', floor: 'dev', kind: 'skill', invoke: '/changelog-writer' },
  { id: 'churn-analysis', name: '解約理由分析', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/churn-analysis', num: 61 },
  { id: 'churn-signal-detect', name: '離脱予兆検知', emoji: '🧩', floor: 'E', kind: 'skill', invoke: '/churn-signal-detect', num: 78 },
  { id: 'citation-formatter', name: '参考文献フォーマッター', emoji: '🧩', floor: 'K', kind: 'skill', invoke: '/citation-formatter', num: 96 },
  { id: 'client-dossier', name: '顧問先カルテ', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/client-dossier', num: 13 },
  { id: 'client-news', name: '顧問先向け週次ニュース', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/client-news', num: 20 },
  { id: 'command-center', name: '統合司令室', emoji: '🧩', floor: 'I', kind: 'skill', invoke: '/command-center', num: 80 },
  { id: 'community-health-watch', name: 'コミュニティ健全性番人', emoji: '🧩', floor: 'E', kind: 'skill', invoke: '/community-health-watch', num: 76 },
  { id: 'company-profiling', name: '痕跡プロファイリング・企業版', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/company-profiling', num: 21 },
  { id: 'competitor-feature-monitor', name: '競合プロダクト機能差分モニタ', emoji: '🧩', floor: 'I', kind: 'skill', invoke: '/competitor-feature-monitor', num: 42 },
  { id: 'competitor-market-research', name: '競合・市場調査', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/competitor-market-research', num: 40 },
  { id: 'contract-check', name: '契約書チェック', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/contract-check', num: 7 },
  { id: 'dashboard-usage-watch', name: 'ダッシュボード利用番人', emoji: '🧩', floor: 'I', kind: 'skill', invoke: '/dashboard-usage-watch', num: 94 },
  { id: 'deal-profitability-tracker', name: '案件収支トラッキング', emoji: '🧩', floor: 'H', kind: 'skill', invoke: '/deal-profitability-tracker', num: 87 },
  { id: 'decision-log', name: '意思決定ログ検索', emoji: '🧩', floor: 'A', kind: 'skill', invoke: '/decision-log', num: 84 },
  { id: 'digital-tourism-ambassador', name: 'デジタル観光大使AIナビゲーター', emoji: '🧩', floor: 'G', kind: 'skill', invoke: '/digital-tourism-ambassador', num: 68 },
  { id: 'effect-measure', name: '導入効果測定', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/effect-measure', num: 17 },
  { id: 'event-prelaunch-check', name: 'イベント公開前チェック', emoji: '🧩', floor: 'D', kind: 'skill', invoke: '/event-prelaunch-check', num: 72 },
  { id: 'faq-vault', name: 'FAQ蓄積', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/faq-vault', num: 23 },
  { id: 'free-diagnosis-content', name: '無料診断コンテンツ', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/free-diagnosis-content', num: 41 },
  { id: 'furusato-nozei', name: 'ふるさと納税連携提案', emoji: '🧩', floor: 'G', kind: 'skill', invoke: '/furusato-nozei', num: 65 },
  { id: 'global-market-research', name: '英語圏市場調査', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/global-market-research', num: 38 },
  { id: 'gov-proposal-custom', name: '自治体向け提案書自動カスタマイズ', emoji: '🧩', floor: 'G', kind: 'skill', invoke: '/gov-proposal-custom', num: 64 },
  { id: 'host-companion', name: 'ホスト伴走', emoji: '🧩', floor: 'E', kind: 'skill', invoke: '/host-companion', num: 74 },
  { id: 'instagram-post', name: 'Instagram投稿下書き', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/instagram-post' },
  { id: 'intern-matching', name: 'インターン参加者事前マッチング', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/intern-matching', num: 48 },
  { id: 'intern-phase-tracker', name: '4フェーズ進行管理', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/intern-phase-tracker', num: 49 },
  { id: 'invoice-draft', name: '請求書ドラフト', emoji: '🧩', floor: 'H', kind: 'skill', invoke: '/invoice-draft', num: 5 },
  { id: 'kit-assembler', name: '導入キット組み立て', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/kit-assembler', num: 28 },
  { id: 'kit-landing-page', name: '導入キット営業ページ生成', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/kit-landing-page', num: 34 },
  { id: 'kit-update-watch', name: 'キット更新番人', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/kit-update-watch', num: 35 },
  { id: 'lead-scout', name: '営業リード発掘', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/lead-scout' },
  { id: 'lecture-note-organizer', name: '授業ノート構造化', emoji: '🧩', floor: 'K', kind: 'skill', invoke: '/lecture-note-organizer', num: 97 },
  { id: 'listing-status-check', name: '出品状況番人', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/listing-status-check', num: 32 },
  { id: 'lit-review-collect', name: '文献収集', emoji: '🧩', floor: 'K', kind: 'skill', invoke: '/lit-review-collect', num: 95 },
  { id: 'market-price-scan', name: '市場価格調査番人', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/market-price-scan', num: 31 },
  { id: 'media-mention-monitor', name: 'メディア言及モニタ', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/media-mention-monitor', num: 55 },
  { id: 'meeting-followup', name: '商談後アクション整理', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/meeting-followup', num: 3 },
  { id: 'meeting-prep', name: '商談準備', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/meeting-prep', num: 2 },
  { id: 'migration-funnel', name: '移住定住導線分析', emoji: '🧩', floor: 'G', kind: 'skill', invoke: '/migration-funnel', num: 67 },
  { id: 'minutes-summary', name: '議事録要約', emoji: '🧩', floor: 'A', kind: 'skill', invoke: '/minutes-summary', num: 24 },
  { id: 'monthly-report', name: '月次顧問レポート生成', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/monthly-report', num: 14 },
  { id: 'mvp-spec', name: 'MVP仕様書', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/mvp-spec', num: 58 },
  { id: 'new-biz-hypothesis', name: '新規事業仮説生成', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/new-biz-hypothesis', num: 39 },
  { id: 'onboarding-dropoff-analysis', name: 'オンボーディング離脱分析', emoji: '🧩', floor: 'D', kind: 'skill', invoke: '/onboarding-dropoff-analysis', num: 73 },
  { id: 'participant-resonance-matching', name: '参加者共鳴マッチング', emoji: '🧩', floor: 'E', kind: 'skill', invoke: '/participant-resonance-matching', num: 75 },
  { id: 'pii-audit', name: '個人情報取扱い番人', emoji: '🧩', floor: 'D', kind: 'skill', invoke: '/pii-audit', num: 82 },
  { id: 'pitch-diff', name: 'ピッチ資料差分生成', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/pitch-diff', num: 9 },
  { id: 'pr-description-writer', name: 'PR説明生成', emoji: '🧩', floor: 'dev', kind: 'skill', invoke: '/pr-description-writer' },
  { id: 'quote-draft', name: '見積書ドラフト', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/quote-draft', num: 1 },
  { id: 'recruit-video-outline', name: '採用PR動画構成案', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/recruit-video-outline', num: 46 },
  { id: 'referral-request', name: '紹介依頼（推譲）ドラフト', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/referral-request', num: 11 },
  { id: 'region-feature-page', name: '地域特集ページ自動編集', emoji: '🧩', floor: 'G', kind: 'skill', invoke: '/region-feature-page', num: 66 },
  { id: 'report-outline', name: 'レポート骨子', emoji: '🧩', floor: 'K', kind: 'skill', invoke: '/report-outline', num: 98 },
  { id: 'resonance-analysis', name: '共鳴分析', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/resonance-analysis', num: 53 },
  { id: 'review-reply', name: 'レビュー返信ドラフト', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/review-reply', num: 33 },
  { id: 'saas-demand-validation', name: 'SaaS需要検証番人', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/saas-demand-validation', num: 56 },
  { id: 'saas-price-monitor', name: 'SaaS競合価格監視番人', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/saas-price-monitor', num: 60 },
  { id: 'sales-email', name: '営業メール下書き', emoji: '🧩', floor: 'B', kind: 'skill', invoke: '/sales-email' },
  { id: 'school-excursion-safety', name: '学校遠足安全管理', emoji: '🧩', floor: 'G', kind: 'skill', invoke: '/school-excursion-safety', num: 69 },
  { id: 'secretary', name: '秘書', emoji: '🧩', floor: 'A', kind: 'skill', invoke: '/secretary', num: 26 },
  { id: 'seminar-progress-tracker', name: 'ゼミ・グループ課題進捗トラッカー', emoji: '🧩', floor: 'K', kind: 'skill', invoke: '/seminar-progress-tracker', num: 99 },
  { id: 'skill-doc-writer', name: 'Skillドキュメント生成', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/skill-doc-writer', num: 30 },
  { id: 'skill-packager', name: 'Skill外販パッケージャ', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/skill-packager', num: 29 },
  { id: 'sla-watch', name: 'SLA番人', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/sla-watch', num: 83 },
  { id: 'speaking-kit', name: '講演依頼対応キット', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/speaking-kit', num: 52 },
  { id: 'sponsor-triage', name: 'スポンサー・自治体トリアージ', emoji: '🧩', floor: 'D', kind: 'skill', invoke: '/sponsor-triage', num: 71 },
  { id: 'staff-trading-card', name: '社員トレーディングカード自動生成', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/staff-trading-card', num: 47 },
  { id: 'subsidy-application', name: '補助金申請書ドラフト支援', emoji: '🧩', floor: 'H', kind: 'skill', invoke: '/subsidy-application', num: 19 },
  { id: 'subsidy-scan', name: '助成金・補助金スキャン', emoji: '🧩', floor: 'H', kind: 'skill', invoke: '/subsidy-scan', num: 18 },
  { id: 'suijo-cycle-visualize', name: '推譲サイクル可視化', emoji: '🧩', floor: 'E', kind: 'skill', invoke: '/suijo-cycle-visualize', num: 77 },
  { id: 'systematic-debugging', name: '系統的デバッグ', emoji: '🧩', floor: 'dev', kind: 'skill', invoke: '/systematic-debugging' },
  { id: 'tax-memo', name: '税務メモ生成', emoji: '🧩', floor: 'H', kind: 'skill', invoke: '/tax-memo', num: 90 },
  { id: 'thesis', name: '卒論支援', emoji: '🧩', floor: 'K', kind: 'skill', invoke: '/thesis' },
  { id: 'thesis-data-extract', name: '研究データ抽出', emoji: '🧩', floor: 'K', kind: 'skill', invoke: '/thesis-data-extract', num: 100 },
  { id: 'time-value-analysis', name: '時間単価分析', emoji: '🧩', floor: 'H', kind: 'skill', invoke: '/time-value-analysis', num: 86 },
  { id: 'trace-reading-training', name: '痕跡解読トレーニング', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/trace-reading-training', num: 50 },
  { id: 'trace-story', name: '痕跡ストーリー化', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/trace-story', num: 54 },
  { id: 'training-builder', name: '研修教材ビルダー', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/training-builder', num: 22 },
  { id: 'training-signup', name: '研修申込ページ・管理', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/training-signup', num: 43 },
  { id: 'training-survey-analysis', name: '研修後アンケート分析', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/training-survey-analysis', num: 44 },
  { id: 'user-interview-analysis', name: 'ユーザーヒアリング分析', emoji: '🧩', floor: 'J', kind: 'skill', invoke: '/user-interview-analysis', num: 59 },
  { id: 'voice-transcribe', name: '音声書き起こし', emoji: '🧩', floor: 'A', kind: 'skill', invoke: '/voice-transcribe' },
  { id: 'waitlist-landing', name: '待機リストLP生成', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/waitlist-landing', num: 57 },
  { id: 'weekly-review', name: '週次レビュー', emoji: '🧩', floor: 'I', kind: 'skill', invoke: '/weekly-review' },
  { id: 'weekly-self-improve', name: '週次自己改善', emoji: '🧩', floor: 'I', kind: 'skill', invoke: '/weekly-self-improve', num: 93 },
  { id: 'work-audit', name: '業務棚卸しヒアリング', emoji: '🧩', floor: 'F', kind: 'skill', invoke: '/work-audit', num: 16 },
  { id: 'x-note-draft', name: 'X/Note下書き', emoji: '🧩', floor: 'C', kind: 'skill', invoke: '/x-note-draft', num: 36 },
];

// 未着工（番人もスキルも無い枠）。#88はmoomoo別リポジトリが担当のため除外。
export const VACANT: AgentDef[] = [

];

export const AGENTS: AgentDef[] = [...SCRIPTS, ...SKILLS, ...VACANT];
