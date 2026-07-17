'use client';

// ============================================================
// 煩悩オークション：投影ウォール
// 黒背景の全画面に、奉納された煩悩が下から立ち上り、漂い、消えていく。
// ・2.5秒ポーリングで新着を取り込む（新着は一度中央に大きく表示してから合流）
// ・運営コンソールのスポットライト指名で、その煩悩だけを中央特大表示
// ・クリックで全画面
// ・スマホ幅（プロジェクターではなく参加者が自分の端末で開いた場合）は、
//   浮遊演出だと文字が重なって読めないため、読みやすい縦一覧表示に切り替える
// ・煩悩をタップすると中央に大きく表示され、そのままBONNOを投資できる
//   （投資ページ(BonnoInvest)と同じvoter_token・予算ロジックを使う）
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route } from '@/lib/types';
import { getOrCreateVoterToken } from '@/lib/bonnoVoter';

interface WallItem {
  id: string;
  text: string;
  nickname: string | null;
  total_bonno: number;
  created_at: string;
}

// 各煩悩の漂い方（位置・速度・揺れ）。一度決めたら固定し、ポーリングのたびに動きが変わらないようにする
interface FloatStyle {
  left: number;      // 画面内の横位置（%）
  duration: number;  // 立ち上りにかける秒数
  delay: number;     // アニメーション開始のずらし（秒）
  drift: number;     // 横揺れ幅（px）
}

const POLL_MS = 2500;
const ANNOUNCE_MS = 5000;
const INVEST_STEP = 10;

export default function BonnoWall({ route }: { route: Route }) {
  const eventSlug = route.event_slug ?? '';
  const [items, setItems] = useState<WallItem[]>([]);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState<WallItem | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voterToken, setVoterToken] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [investPending, setInvestPending] = useState(false);
  const [investError, setInvestError] = useState<string | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const floatStyles = useRef<Map<string, FloatStyle>>(new Map());
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 700);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const token = getOrCreateVoterToken(eventSlug);
    setVoterToken(token);
    fetch(`/api/bonno/invest?event_slug=${encodeURIComponent(eventSlug)}&voter_token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => { if (data.ok) setRemaining(data.remaining); })
      .catch(() => {});
  }, [eventSlug]);

  const invest = async (id: string) => {
    if (!voterToken || investPending) return;
    if (remaining < INVEST_STEP) {
      setInvestError('残り予算が足りません');
      return;
    }
    setInvestPending(true);
    setInvestError(null);
    try {
      const res = await fetch('/api/bonno/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_slug: eventSlug, submission_id: id, voter_token: voterToken, amount: INVEST_STEP }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setInvestError(data.error ?? '投資に失敗しました');
        return;
      }
      setRemaining(data.remaining);
      setItems((prev) => prev.map((it) => it.id === id ? { ...it, total_bonno: data.submission_total } : it));
    } catch {
      setInvestError('通信に失敗しました');
    } finally {
      setInvestPending(false);
    }
  };

  const styleFor = (id: string): FloatStyle => {
    let s = floatStyles.current.get(id);
    if (!s) {
      s = {
        left: 4 + Math.random() * 80,
        duration: 20 + Math.random() * 20,
        delay: -Math.random() * 30, // 負のdelayで初期表示から画面全体に散らばる
        drift: (Math.random() - 0.5) * 120,
      };
      floatStyles.current.set(id, s);
    }
    return s;
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bonno?event_slug=${encodeURIComponent(eventSlug)}`);
      const data = await res.json();
      if (!data.ok) return;
      const list = data.items as WallItem[];
      setSpotlightId(data.spotlight_id ?? null);

      // 新着（初回ロード分は除く）は一度中央に大きく掲げてから、漂う群れに合流させる
      const fresh = list.filter((it) => !knownIds.current.has(it.id));
      list.forEach((it) => knownIds.current.add(it.id));
      if (!firstLoad.current && fresh.length > 0) {
        setAnnounce(fresh[fresh.length - 1]);
        if (announceTimer.current) clearTimeout(announceTimer.current);
        announceTimer.current = setTimeout(() => setAnnounce(null), ANNOUNCE_MS);
      }
      firstLoad.current = false;
      setItems(list);
    } catch {
      // 会場Wi-Fiの瞬断でも演出を止めない（次のポーリングで回復する）
    }
  }, [eventSlug]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearInterval(timer);
      if (announceTimer.current) clearTimeout(announceTimer.current);
    };
  }, [load]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const spotlight = spotlightId ? items.find((it) => it.id === spotlightId) ?? null : null;
  const selected = selectedId ? items.find((it) => it.id === selectedId) ?? null : null;
  const dimmed = Boolean(spotlight || announce || selected);

  // BONNO投資を集めた煩悩ほど大きく画面に浮かび上がる
  const fontSizeFor = (it: WallItem) => {
    const base = it.text.length > 60 ? 22 : it.text.length > 30 ? 26 : 32;
    const boost = Math.min(it.total_bonno ?? 0, 100) / 10;
    return base + boost;
  };

  return (
    <main
      onClick={toggleFullscreen}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 120%, #16160f 0%, #0a0a08 70%)',
        overflow: 'hidden',
        cursor: 'pointer',
        fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
      }}
    >
      <style>{`
        @keyframes bonnoRise {
          0%   { transform: translateY(105vh) translateX(0); opacity: 0; }
          8%   { opacity: 0.9; }
          80%  { opacity: 0.75; }
          100% { transform: translateY(-25vh) translateX(var(--drift)); opacity: 0; }
        }
        @keyframes bonnoAppear {
          0%   { transform: scale(0.92); opacity: 0; }
          12%  { transform: scale(1); opacity: 1; }
          88%  { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.02); opacity: 0; }
        }
        @keyframes bonnoGlow {
          0%, 100% { text-shadow: 0 0 24px rgba(214, 200, 160, 0.25); }
          50%      { text-shadow: 0 0 44px rgba(214, 200, 160, 0.5); }
        }
      `}</style>

      {/* 漂う煩悩の群れ：スマホ幅では重なって読めないため、読みやすい縦一覧に切り替える */}
      {isNarrow ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: dimmed ? 0.08 : 1,
            transition: 'opacity 1.2s ease',
            overflowY: 'auto',
            padding: '28px 20px 60px',
          }}
        >
          {items.slice().reverse().map((it) => (
            <div
              key={it.id}
              onClick={(e) => { e.stopPropagation(); setSelectedId(it.id); }}
              style={{ marginBottom: 22, paddingBottom: 22, borderBottom: '1px solid rgba(232, 224, 204, 0.12)', cursor: 'pointer' }}
            >
              <p style={{ margin: 0, color: '#E8E0CC', fontSize: 18, lineHeight: 1.8, letterSpacing: 0.5, whiteSpace: 'pre-wrap' }}>
                {it.text}
              </p>
              {(it.nickname || (it.total_bonno ?? 0) > 0) && (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: '#8F8770' }}>
                  {it.nickname && `— ${it.nickname}`}
                  {(it.total_bonno ?? 0) > 0 && ` 💰${it.total_bonno}`}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, opacity: dimmed ? 0.08 : 1, transition: 'opacity 1.2s ease' }}>
          {items.map((it) => {
            const s = styleFor(it.id);
            return (
              <p
                key={it.id}
                onClick={(e) => { e.stopPropagation(); setSelectedId(it.id); }}
                style={{
                  position: 'absolute',
                  left: `${s.left}%`,
                  top: 0,
                  maxWidth: '38vw',
                  margin: 0,
                  color: '#E8E0CC',
                  fontSize: fontSizeFor(it),
                  lineHeight: 1.6,
                  letterSpacing: 1,
                  whiteSpace: 'pre-wrap',
                  cursor: 'pointer',
                  animation: `bonnoRise ${s.duration}s linear ${s.delay}s infinite`,
                  ['--drift' as string]: `${s.drift}px`,
                  willChange: 'transform, opacity',
                }}
              >
                {it.text}
                {(it.nickname || (it.total_bonno ?? 0) > 0) && (
                  <span style={{ display: 'block', fontSize: 14, color: '#8F8770', marginTop: 6 }}>
                    {it.nickname && `— ${it.nickname}`}
                    {(it.total_bonno ?? 0) > 0 && ` 💰${it.total_bonno}`}
                  </span>
                )}
              </p>
            );
          })}
        </div>
      )}

      {/* 中央特大表示：スポットライト（運営指名）が最優先、次に新着のお披露目 */}
      {(spotlight ?? announce) && (
        <div
          key={(spotlight ?? announce)!.id + (spotlight ? '-spot' : '-new')}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8vw',
            textAlign: 'center',
            animation: spotlight ? 'none' : `bonnoAppear ${ANNOUNCE_MS / 1000}s ease forwards`,
          }}
        >
          {!spotlight && (
            <p style={{ fontSize: 16, letterSpacing: 6, color: '#8F8770', margin: '0 0 28px' }}>
              新しい煩悩が奉納されました
            </p>
          )}
          <p style={{
            margin: 0,
            color: '#F2EBD8',
            fontSize: 'clamp(34px, 5.5vw, 76px)',
            lineHeight: 1.7,
            letterSpacing: 2,
            whiteSpace: 'pre-wrap',
            animation: 'bonnoGlow 4s ease-in-out infinite',
          }}>
            {(spotlight ?? announce)!.text}
          </p>
          {(spotlight ?? announce)!.nickname && (
            <p style={{ fontSize: 'clamp(16px, 1.8vw, 26px)', color: '#A89E82', margin: '32px 0 0', letterSpacing: 3 }}>
              — {(spotlight ?? announce)!.nickname}
            </p>
          )}
        </div>
      )}

      {/* タップされた煩悩の拡大表示＋その場でBONNO投資（スポットライト・新着お披露目がないときのみ） */}
      {selected && !spotlight && !announce && (
        <div
          onClick={(e) => { e.stopPropagation(); setSelectedId(null); }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8vw',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <p style={{
            margin: '0 0 24px',
            color: '#F2EBD8',
            fontSize: 'clamp(28px, 4.5vw, 64px)',
            lineHeight: 1.7,
            letterSpacing: 2,
            whiteSpace: 'pre-wrap',
          }}>
            {selected.text}
          </p>
          {selected.nickname && (
            <p style={{ fontSize: 'clamp(14px, 1.6vw, 22px)', color: '#A89E82', margin: '0 0 20px', letterSpacing: 2 }}>
              — {selected.nickname}
            </p>
          )}
          <p style={{ fontSize: 16, color: '#D6C8A0', margin: '0 0 20px', letterSpacing: 2 }}>
            💰 {selected.total_bonno} BONNO
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); invest(selected.id); }}
            disabled={investPending || remaining < INVEST_STEP}
            style={{
              padding: '12px 32px',
              borderRadius: 999,
              border: 'none',
              background: investPending || remaining < INVEST_STEP ? 'rgba(232, 224, 204, 0.2)' : '#D6C8A0',
              color: investPending || remaining < INVEST_STEP ? '#8F8770' : '#23231F',
              fontSize: 16,
              fontWeight: 800,
              cursor: investPending || remaining < INVEST_STEP ? 'default' : 'pointer',
            }}
          >
            {investPending ? '投資中…' : `+${INVEST_STEP} BONNOを投資`}
          </button>
          {investError && (
            <p style={{ fontSize: 13, color: '#D46A5C', margin: '16px 0 0' }}>{investError}</p>
          )}
          <p style={{ fontSize: 12, color: '#5C574A', margin: '20px 0 0', letterSpacing: 2 }}>
            残り予算 {remaining} BONNO ・ タップして閉じる
          </p>
        </div>
      )}

      {/* まだ投稿がないときの案内 */}
      {items.length === 0 && !announce && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <p style={{ color: '#5C574A', fontSize: 22, letterSpacing: 6 }}>
            まだ、誰も打ち明けていません
          </p>
        </div>
      )}
    </main>
  );
}
