import { corpColor } from './tokens';

// 町の街路グリッド＋感情のにじみ（ヒート）＋痕跡ピンを抽象化したSVG。Heroの背景として作った意匠を
// サイト内の他の場所（MVV演出など）でも同じ世界観の「別の区画の地図」として再利用する。
// variant で色味とにじみの位置をわずかに変え、単なる使い回しに見えないようにする。
const VARIANTS = [
  { heatA: corpColor.moss, heatB: corpColor.mossDeep, pin: corpColor.mossDeep },
  { heatA: corpColor.ink, heatB: corpColor.moss, pin: corpColor.ink },
  { heatA: corpColor.mossDeep, heatB: corpColor.ink, pin: corpColor.mossDeep },
] as const;

export default function MapArt({ variant = 0, id = 'a' }: { variant?: 0 | 1 | 2; id?: string }) {
  const v = VARIANTS[variant];
  const gidA = `heat-a-${id}`;
  const gidB = `heat-b-${id}`;
  return (
    <svg
      viewBox="0 0 720 480"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gidA} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={v.heatA} stopOpacity="0.34" />
          <stop offset="100%" stopColor={v.heatA} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gidB} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={v.heatB} stopOpacity="0.22" />
          <stop offset="100%" stopColor={v.heatB} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 街路：不規則な格子。等間隔にしない（実在の町並みの歪みを写す） */}
      <g stroke={corpColor.ink} strokeOpacity="0.13" strokeWidth="1" fill="none">
        <path d="M0 96 L720 74" />
        <path d="M0 182 L720 196" />
        <path d="M0 286 L720 262" />
        <path d="M0 388 L720 402" />
        <path d="M88 0 L112 480" />
        <path d="M214 0 L198 480" />
        <path d="M348 0 L360 480" />
        <path d="M470 0 L452 480" />
        <path d="M598 0 L612 480" />
        <path d="M0 330 C 160 300, 300 380, 460 340 S 680 250, 720 268" strokeOpacity="0.2" strokeWidth="1.5" />
      </g>

      {/* 感情のにじみ：区画ごとに位置を少しずらし、ゆっくり漂わせる */}
      <g className="hm-drift">
        <circle cx={205 + variant * 60} cy={190 - variant * 30} r="150" fill={`url(#${gidA})`} />
        <circle cx={480 - variant * 40} cy={330 + variant * 20} r="190" fill={`url(#${gidA})`} />
      </g>
      <g className="hm-drift-slow">
        <circle cx={600 - variant * 50} cy={120 + variant * 40} r="120" fill={`url(#${gidB})`} />
        <circle cx={120 + variant * 70} cy={400 - variant * 60} r="110" fill={`url(#${gidB})`} />
      </g>

      {/* 痕跡ピン（点） */}
      <g fill={v.pin}>
        <circle cx="205" cy="190" r="4" />
        <circle cx="252" cy="168" r="3" />
        <circle cx="178" cy="238" r="3" />
        <circle cx="480" cy="330" r="4" />
        <circle cx="512" cy="300" r="3" />
        <circle cx="443" cy="356" r="3" />
        <circle cx="600" cy="120" r="3.5" />
        <circle cx="120" cy="400" r="3" />
        <circle cx="352" cy="92" r="2.5" />
      </g>
    </svg>
  );
}
