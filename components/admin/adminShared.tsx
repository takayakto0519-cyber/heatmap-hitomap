'use client';

// 運営ダッシュボードの複数タブで共有するプリミティブ・型・フック。
// monolith分割（app/admin/dashboard/page.tsx の薄型化）で切り出し。
import { useEffect, useState } from 'react';
import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';

export const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
};
export interface AdminUserRecentTrace {
  id: string;
  title: string;
  photo_url: string | null;
  emotion_key: string | null;
  visibility: string;
  why: string | null;
  interpretation: string | null;
  self_reflection: string | null;
  region: string | null;
  category: string | null;
  created_at: string;
}
export interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  traceCount: number;
  lastPostedAt: string | null;
  followerCount: number;
  followingCount: number;
  recentTraces: AdminUserRecentTrace[];
  auto_approve: boolean;
}
export const VISIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  public: { label: '🌏 全国公開', color: '#38ADA9' },
  followers: { label: '👥 フォロワー限定', color: '#4A69BD' },
  private: { label: '🔒 非公開', color: '#999' },
  pending_review: { label: '⏳ 審査待ち', color: '#E5A139' },
};
export function useAuthorMap(authHeaders: () => HeadersInit) {
  const [authorMap, setAuthorMap] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  useEffect(() => {
    fetch('/api/admin/profiles', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const map: Record<string, { username: string; avatar_url: string | null }> = {};
        for (const u of d.users as AdminUser[]) map[u.id] = { username: u.username, avatar_url: u.avatar_url };
        setAuthorMap(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return authorMap;
}
export function AuthorLine({ trace, authorMap }: { trace: Trace; authorMap: Record<string, { username: string; avatar_url: string | null }> }) {
  if (trace.user_id) {
    const author = authorMap[trace.user_id];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
        ) : '👤'}
        {author ? `@${author.username}` : 'ログインユーザー'}
      </span>
    );
  }
  // 未登録（非会員）投稿：ニックネームがあればそれを、無くてもsession_code（実験回の識別）が
  // あれば表示し、運営が同一人物の複数投稿をたどれるようにする。両方無ければ本当に匿名として表示。
  if (trace.nickname?.trim()) return <span>🕶 {trace.nickname}</span>;
  if (trace.session_code?.trim()) return <span title="ニックネーム未入力。実験回の識別コードで表示">🕶 匿名（{trace.session_code}）</span>;
  return <span>🕶 匿名</span>;
}
export function ContentTags({ trace }: { trace: Trace }) {
  const emotion = getEmotion(trace.emotion_key);
  const category = getCategory(trace.category);
  if (!emotion && !category && !trace.video_url) return null;
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '4px 0' }}>
      {emotion && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: emotion.color + '22', color: emotion.color, fontSize: 11, fontWeight: 700 }}>
          {emotion.emoji} {emotion.label}
        </span>
      )}
      {category && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: '#f0f0f0', color: '#666', fontSize: 11 }}>
          {category.emoji} {category.label}
        </span>
      )}
      {trace.video_url && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: '#EEF4FF', color: '#4A90E2', fontSize: 11, fontWeight: 700 }}>🎥 動画</span>
      )}
    </div>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

// 統合司令室(command_center)が抽出した「今すぐ判断が要ること」1件分。
// ホーム(OverviewTab)と秘書(SecretaryTab)の両方が /api/admin/command-center から取得して表示する。
export interface AttentionItem { agent_id: string; floor: string; name: string; headline: string }
// 要注意項目から運営ダッシュボードのタブへ飛べるものは飛ばす
export const ATTENTION_JUMP: Record<string, { tab: string; label: string }> = {
  report_screen: { tab: 'reports', label: '通報へ' },
  spam_detect: { tab: 'traces', label: '投稿管理へ' },
  trace_qa: { tab: 'traces', label: '投稿管理へ' },
  deadline_watch: { tab: 'funding', label: 'コンテスト・助成金へ' },
  case_pipeline_watch: { tab: 'sales', label: '営業へ' },
  payment_watch: { tab: 'sales', label: '営業（案件）へ' },
};

// ---------- ここから下は「同じ見た目を各タブが手書きしていた」ものの共通化 ----------

/** サイドバーのバッジ件数。タブIDをキーにしたマップ（/api/admin/stats が返す badges と同じ形）。 */
export type TabBadgeCounts = Record<string, number>;

/**
 * ステータス切替のピルボタン。ビジネスモデル案・学校法人・イベント計画・提案ボード等で
 * 同じ見た目を各ファイルが手書きしていたのを1つにまとめたもの。
 */
export function StatusPill({ label, color, active, onClick, disabled }: {
  label: string;
  color: string;
  active: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: onClick && !disabled ? 'pointer' : 'default',
      border: `1.5px solid ${active ? color : '#ddd'}`,
      background: active ? color + '18' : '#fff',
      color: active ? color : '#999', fontWeight: active ? 700 : 400,
      fontFamily: 'inherit',
    }}>{label}</button>
  );
}

/**
 * テーブル未作成（マイグレーション未適用）の案内。
 * このプロジェクトはSQLを会長が手で適用する運用なので、生のPostgresエラーを出さずに
 * 「どのファイルをSQL Editorで流せばよいか」を伝える。
 */
export function MigrationNotice({ title, migrationFile }: { title: string; migrationFile: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      marginBottom: 12, borderLeft: '4px solid #E5A139',
    }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#B7791F' }}>⚠ {title}</p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777', lineHeight: 1.7 }}>
        <code style={{ background: '#f4f4f4', padding: '1px 5px', borderRadius: 4 }}>{migrationFile}</code> を
        SupabaseのSQL Editorで一度実行してください。
      </p>
    </div>
  );
}

/** 各タブがバラバラに手書きしていたステータス色をここに一本化する。 */
export const ADMIN_COLORS = {
  teal: '#38ADA9', blue: '#4A69BD', orange: '#E5A139', red: '#E74C3C',
  purple: '#8E44AD', yellow: '#F6B93B', gray: '#999', green: '#27AE60',
} as const;

/** ビジネスモデル案のステータス（BizModelIdeasTab・強化タブ共通）。 */
export const BIZMODEL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea: { label: '💡 アイデア', color: ADMIN_COLORS.purple },
  validating: { label: '🔍 検証中', color: ADMIN_COLORS.yellow },
  building: { label: '🛠 構築中', color: ADMIN_COLORS.blue },
  live: { label: '🚀 稼働中', color: ADMIN_COLORS.teal },
  shelved: { label: '📦 保留', color: '#aaa' },
};

/** strategy_proposals の受信トレイ系タブ共通ステータス。「採用/実行」の色を teal に統一。 */
export const PROPOSAL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unread: { label: '📥 未読', color: ADMIN_COLORS.gray },
  reviewing: { label: '🔍 検討中', color: ADMIN_COLORS.yellow },
  adopted: { label: '✅ 採用', color: ADMIN_COLORS.teal },
  shelved: { label: '📦 見送り', color: '#ccc' },
};

/**
 * ステータス切替のピル列。BizModelIdeasTab・StrategyProposalsTab・MarketingProposalsTab が
 * 同じ見た目（{Object.entries(...).map(StatusPill)}）を各自手書きしていたのを1部品にまとめたもの。
 */
export function StatusPillRow({ labels, current, onSelect }: {
  labels: Record<string, { label: string; color: string }>;
  current: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {Object.entries(labels).map(([key, info]) => (
        <StatusPill key={key} label={info.label} color={info.color} active={current === key} onClick={() => onSelect(key)} />
      ))}
    </div>
  );
}

export function LoadingLine({ label = '読み込み中…' }: { label?: string }) {
  return <p style={{ color: '#999', fontSize: 12, margin: '8px 0' }}>{label}</p>;
}

/** 画面全体を潰さずにエラーだけ伝える帯。中身は描画したまま上に出す用。 */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      background: '#FFF7F5', border: '1px solid #FFD9D0', borderRadius: 10,
      padding: '8px 12px', marginBottom: 12,
    }}>
      <p style={{ margin: 0, fontSize: 12.5, color: '#C0392B' }}>{message}</p>
    </div>
  );
}
