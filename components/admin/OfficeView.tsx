'use client';

// 🏢 ドット絵オフィス表示 — AIエージェント（自動実行の番人）とスキル（会話で呼ぶAI）を
// 合わせた「全社員」を、部門ごとの「部屋」に可視化する。
// 稼働中(working)は机についてPC画面のスピナーが回り、それ以外（待機中・同期済み・
// スキルは常時）は部屋の中をうろうろ歩き回る。
// キャラクター・PC・ウォータークーラーのスプライトはOpenGameArt.orgの
// "Office worker sprites"（作者：Solar Granulation、CC-BY 3.0/4.0）。
// 床・窓・観葉植物・絵画・キャビネットはKenney「Roguelike/RPG pack」（CC0、www.kenney.nl）から抜粋。
import { useMemo } from 'react';
import { SKILLS } from '@/lib/agents/roster';

interface Floor { id: string; name: string; emoji: string; order: number }
interface AgentStatus {
  id: string; name: string; emoji: string; floor: string; schedule: string;
  status: 'working' | 'resting' | 'synced';
  result: Record<string, unknown> | null;
  generatedAt: string | null;
  level: number; xp: number;
}

const SKINS = [
  '/assets/office/WorkerSheetBrownPurple.png',
  '/assets/office/WorkerSheetBrownWhite.png',
  '/assets/office/WorkerSheetYellowPurple.png',
  '/assets/office/WorkerSheetYellowWhite.png',
];
const SCALE = 3; // 16px原寸 → 48px表示
const FRAME = 16 * SCALE;
const WORKER_SHEET_W = 4 * FRAME;
const WORKER_SHEET_H = 10 * FRAME;
const COMPUTER_SHEET_W = 5 * FRAME;
const COMPUTER_SHEET_H = 10 * FRAME;
const DECOR_SCALE = 2.5;
const DECOR = 16 * DECOR_SCALE;

// 部門ごとに部屋の装飾（絵画・観葉植物・キャビネット）の組み合わせを変え、部屋ごとの個性を出す。
const PICTURES = ['/assets/office/room/picture.png', '/assets/office/room/picture2.png'];
const BUSHES = ['/assets/office/room/plant.png', '/assets/office/room/bush2.png'];
const CABINETS = ['/assets/office/room/cabinet.png', '/assets/office/room/cabinet2.png'];

function hash(id: string, salt: string): number {
  let h = 0;
  const s = id + salt;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function hashSkin(id: string): number {
  return hash(id, 'skin') % SKINS.length;
}
// -1〜1の範囲で決定的な擬似乱数を作る（idごとに固定、リロードでガタつかない）
function pseudo(id: string, salt: string): number {
  return ((hash(id, salt) % 2000) / 1000) - 1;
}

function isAttention(result: Record<string, unknown> | null): boolean {
  if (!result) return false;
  if (result.error) return true;
  return false;
}

function statusLabel(a: AgentStatus, isSkill: boolean): string {
  if (isSkill) return 'スキル（会話で呼び出すAI・待機中）';
  return a.status === 'working' ? '実行中（デスクで作業中）' : a.status === 'synced' ? '同期済み（フロアを巡回中）' : '待機中（フロアを巡回中）';
}

// 🖥️ 稼働中：机についてPC画面が回る
function DeskWorker({ a }: { a: AgentStatus }) {
  const skin = SKINS[hashSkin(a.id)];
  const attention = isAttention(a.result);
  return (
    <div title={`${a.name}（${statusLabel(a, false)}）`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: FRAME + 10 }}>
      <div
        className="office-monitor-working"
        style={{
          width: FRAME, height: FRAME, flexShrink: 0,
          backgroundImage: 'url(/assets/office/ComputerSheet.png)',
          backgroundSize: `${COMPUTER_SHEET_W}px ${COMPUTER_SHEET_H}px`,
          backgroundPosition: attention ? `-${2 * FRAME}px -${7 * FRAME}px` : undefined,
          imageRendering: 'pixelated',
        }}
      />
      <div
        className="office-worker-working"
        style={{
          width: FRAME, height: FRAME, flexShrink: 0, marginTop: -6,
          backgroundImage: `url(${skin})`,
          backgroundSize: `${WORKER_SHEET_W}px ${WORKER_SHEET_H}px`,
          imageRendering: 'pixelated',
        }}
      />
      <span style={{ fontSize: 9, color: '#777', marginTop: 2, maxWidth: FRAME + 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {a.emoji}{a.name.replace(/^\d+\.\s*/, '').replace(/^👑\s*/, '')}
      </span>
    </div>
  );
}

// 🚶 待機中／スキル：机を離れてフロアをうろうろ歩き回る（idごとに決まった軌道でランダムに揺れる）
function Wanderer({ a, isSkill }: { a: AgentStatus; isSkill: boolean }) {
  const skin = SKINS[hashSkin(a.id)];
  const dur = 3 + Math.abs(pseudo(a.id, 'dur')) * 3.5; // 3〜6.5秒
  const delay = Math.abs(pseudo(a.id, 'delay')) * -dur; // 開始位置をずらす
  const wx = pseudo(a.id, 'x') * 16; // ±16px
  const wy = pseudo(a.id, 'y') * 8; // ±8px
  const size = FRAME * 0.6;

  return (
    <div title={`${a.name}（${statusLabel(a, isSkill)}）`}
      className="office-wander"
      style={{
        width: size, height: size, flexShrink: 0, opacity: isSkill ? 0.75 : 1,
        // @ts-expect-error CSS変数
        '--wx': `${wx}px`, '--wy': `${wy}px`,
        animationDuration: `${dur}s`, animationDelay: `${delay}s`,
      }}
    >
      <div
        className="office-worker-idle"
        style={{
          width: size, height: size,
          backgroundImage: `url(${skin})`,
          backgroundSize: `${WORKER_SHEET_W * (size / FRAME)}px ${WORKER_SHEET_H * (size / FRAME)}px`,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

function Room({ floor, agents, skills }: { floor: Floor; agents: AgentStatus[]; skills: AgentStatus[] }) {
  const working = agents.filter(a => a.status === 'working');
  const wandering = agents.filter(a => a.status !== 'working');
  const idx = hash(floor.id, 'decor');
  const picture = PICTURES[idx % PICTURES.length];
  const picture2 = PICTURES[(idx + 1) % PICTURES.length];
  const bush = BUSHES[idx % BUSHES.length];
  const cabinet = CABINETS[idx % CABINETS.length];
  const total = agents.length + skills.length;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '3px solid #b9c2b6', marginBottom: 18, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
      {/* 壁：窓＋絵画を並べる */}
      <div style={{
        background: 'linear-gradient(#faf7ee, #f1ead3)', borderBottom: '4px solid #c9bd8f',
        padding: '10px 12px 6px', display: 'flex', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap', position: 'relative',
      }}>
        <img src="/assets/office/room/window.png" alt="" width={DECOR} height={DECOR} style={{ imageRendering: 'pixelated' }} />
        <img src={picture} alt="" width={DECOR} height={DECOR} style={{ imageRendering: 'pixelated' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#4a4536' }}>{floor.emoji} {floor.name.replace('（部長）', '')}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#00000010', color: '#665' }}>🪑 全員{total}名</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            background: working.length > 0 ? '#27AE6022' : '#00000010', color: working.length > 0 ? '#1E8449' : '#887',
          }}>⚡ 稼働中 {working.length}</span>
        </div>
        <img src={picture2} alt="" width={DECOR} height={DECOR} style={{ imageRendering: 'pixelated', marginLeft: 'auto' }} />
        <img src="/assets/office/room/window.png" alt="" width={DECOR} height={DECOR} style={{ imageRendering: 'pixelated' }} />
      </div>

      {/* 床：稼働中はデスク列、それ以外（待機中＋スキル）はフロアをうろうろ */}
      <div style={{
        backgroundImage: 'url(/assets/office/room/floor.png)',
        backgroundSize: `${16 * DECOR_SCALE}px ${16 * DECOR_SCALE}px`,
        backgroundRepeat: 'repeat', imageRendering: 'pixelated',
        padding: '14px 12px', position: 'relative',
      }}>
        <img src={bush} alt="" width={DECOR} height={DECOR} style={{ imageRendering: 'pixelated', position: 'absolute', top: 8, left: 8, opacity: 0.9 }} />
        <img src={cabinet} alt="" width={DECOR} height={DECOR} style={{ imageRendering: 'pixelated', position: 'absolute', top: 8, right: 8, opacity: 0.9 }} />

        {working.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 8px', marginBottom: 14, paddingBottom: 12, borderBottom: '2px dashed #d3ccb5', marginTop: 6, paddingLeft: DECOR + 6 }}>
            {working.map(a => <DeskWorker key={a.id} a={a} />)}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingLeft: DECOR + 6, paddingTop: working.length > 0 ? 0 : 6 }}>
          {wandering.map(a => <Wanderer key={a.id} a={a} isSkill={false} />)}
          {skills.map(a => <Wanderer key={a.id} a={a} isSkill />)}
        </div>
      </div>
    </div>
  );
}

export default function OfficeView({ floors, agents }: { floors: Floor[]; agents: AgentStatus[] }) {
  const byFloor = useMemo(() => {
    const map = new Map<string, AgentStatus[]>();
    for (const a of agents) {
      const list = map.get(a.floor) ?? [];
      list.push(a);
      map.set(a.floor, list);
    }
    return map;
  }, [agents]);

  const skillsByFloor = useMemo(() => {
    const map = new Map<string, AgentStatus[]>();
    for (const s of SKILLS) {
      const list = map.get(s.floor) ?? [];
      list.push({
        id: s.id, name: s.name, emoji: s.emoji, floor: s.floor, schedule: '',
        status: 'resting', result: null, generatedAt: null, level: 1, xp: 0,
      });
      map.set(s.floor, list);
    }
    return map;
  }, []);

  const orderedFloors = [...floors].sort((a, b) => a.order - b.order)
    .filter(f => (byFloor.get(f.id)?.length ?? 0) > 0 || (skillsByFloor.get(f.id)?.length ?? 0) > 0);
  const totalWorking = agents.filter(a => a.status === 'working').length;
  const totalHeadcount = agents.length + SKILLS.length;

  return (
    <div>
      <style>{`
        @keyframes officeIdleBob {
          0%, 49% { background-position: 0px 0px; }
          50%, 100% { background-position: 0px -${2 * FRAME}px; }
        }
        @keyframes officeWorkingType {
          0%, 49% { background-position: 0px -${4 * FRAME}px; }
          50%, 100% { background-position: 0px -${5 * FRAME}px; }
        }
        @keyframes officeMonitorSpin {
          0% { background-position: 0px 0px; }
          20% { background-position: -${FRAME}px 0px; }
          40% { background-position: -${2 * FRAME}px 0px; }
          60% { background-position: -${3 * FRAME}px 0px; }
          80%, 100% { background-position: -${4 * FRAME}px 0px; }
        }
        @keyframes officeWanderWalk {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(var(--wx), calc(var(--wy) * -1)); }
          50%  { transform: translate(calc(var(--wx) * -1), var(--wy)); }
          75%  { transform: translate(calc(var(--wx) * 0.6), calc(var(--wy) * 0.6)); }
          100% { transform: translate(0, 0); }
        }
        .office-worker-idle { animation: officeIdleBob 2.4s steps(1) infinite; }
        .office-worker-working { animation: officeWorkingType 0.6s steps(1) infinite; }
        .office-monitor-working { animation: officeMonitorSpin 1s steps(1) infinite; }
        .office-wander { animation-name: officeWanderWalk; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#444' }}>🏢 ヒトマップビル（オフィス表示）</span>
        <span style={{ fontSize: 11, color: totalWorking > 0 ? '#1E8449' : '#999', fontWeight: 700 }}>
          全社員{totalHeadcount}名（自動稼働{agents.length}名＋スキル{SKILLS.length}名）・稼働中{totalWorking}名
        </span>
      </div>

      {orderedFloors.map(floor => (
        <Room key={floor.id} floor={floor} agents={byFloor.get(floor.id) ?? []} skills={skillsByFloor.get(floor.id) ?? []} />
      ))}

      <p style={{ fontSize: 9.5, color: '#bbb', marginTop: 6 }}>
        Office worker sprites by Solar Granulation（OpenGameArt.org, CC-BY 3.0/4.0）／ Room decor: Kenney Roguelike/RPG pack（CC0, kenney.nl）
      </p>
    </div>
  );
}
