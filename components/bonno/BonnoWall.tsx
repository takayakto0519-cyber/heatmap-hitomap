'use client';

// ============================================================
// 煩悩オークション：投影ウォール
// 黒背景の全画面に、奉納された煩悩が下から立ち上り、漂い、消えていく。
// ・2.5秒ポーリングで新着を取り込む（新着は一度中央に大きく表示してから合流）
// ・運営コンソールのスポットライト指名で、その煩悩だけを中央特大表示
// ・クリックで全画面、qキーで参加QRの表示/非表示
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Route } from '@/lib/types';

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

export default function BonnoWall({ route }: { route: Route }) {
  const [items, setItems] = useState<WallItem[]>([]);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState<WallItem | null>(null);
  const [showQr, setShowQr] = useState(true);
  const [eventUrl, setEventUrl] = useState('');
  const knownIds = useRef<Set<string>>(new Set());
  const floatStyles = useRef<Map<string, FloatStyle>>(new Map());
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoad = useRef(true);

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
      const res = await fetch(`/api/bonno?event_slug=${encodeURIComponent(route.event_slug ?? '')}`);
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
  }, [route.event_slug]);

  useEffect(() => {
    setEventUrl(`${window.location.origin}/events/${route.event_slug}`);
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearInterval(timer);
      if (announceTimer.current) clearTimeout(announceTimer.current);
    };
  }, [load, route.event_slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'q' || e.key === 'Q') setShowQr((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const spotlight = spotlightId ? items.find((it) => it.id === spotlightId) ?? null : null;
  const dimmed = Boolean(spotlight || announce);

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

      {/* 漂う煩悩の群れ */}
      <div style={{ position: 'absolute', inset: 0, opacity: dimmed ? 0.08 : 1, transition: 'opacity 1.2s ease' }}>
        {items.map((it) => {
          const s = styleFor(it.id);
          return (
            <p
              key={it.id}
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

      {/* 参加QRコーナー（qキーで表示切替） */}
      {showQr && eventUrl && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 28,
            bottom: 28,
            background: 'rgba(242, 235, 216, 0.95)',
            borderRadius: 12,
            padding: '14px 14px 10px',
            textAlign: 'center',
            cursor: 'default',
          }}
        >
          <QRCodeSVG value={eventUrl} size={110} bgColor="transparent" fgColor="#23231F" />
          <p style={{ fontSize: 11, fontWeight: 700, color: '#23231F', margin: '8px 0 0', letterSpacing: 1 }}>
            あなたの煩悩を奉納する
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
