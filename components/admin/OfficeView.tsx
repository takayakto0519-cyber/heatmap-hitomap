'use client';

// 🏢 ドット絵オフィス表示 — AIエージェントの稼働状況を、部門ごとの「部屋」に可視化する。
// 稼働中(working)は机についてPC画面のスピナーが回り、待機中(resting/synced)は
// 部屋の中を自由にうろうろ歩き回る（机にはつかない）。
// キャラクター・PC・ウォータークーラーのスプライトはOpenGameArt.orgの
// "Office worker sprites"（作者：Solar Granulation、CC-BY 3.0/4.0）。
// 壁の絵・観葉植物・キャビネットはKenney「Roguelike/RPG pack」（CC0、www.kenney.nl）から抜粋。
import { useMemo } from 'react';

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

function statusLabel(a: AgentStatus): string {
  return a.status === 'working' ? '実行中（デスクで作業中）' : a.status === 'synced' ? '同期済み（フロアを巡回中）' : '待機中（フロアを巡回中）';
}

// 🖥️ 稼働中：机についてPC画面が回る
function DeskWorker({ a }: { a: AgentStatus }) {
  const skin = SKINS[hashSkin(a.id)];
  const attention = isAttention(a.result);
  return (
    <div title={`${a.name}（${statusLabel(a)}）`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: FRAME + 10 }}>
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

// 🚶 待機中：机を離れてフロアをうろうろ歩き回る（idごとに決まった軌道でランダムに揺れる）
function Wanderer({ a }: { a: AgentStatus }) {
  const skin = SKINS[hashSkin(a.id)];
  const dur = 3 + Math.abs(pseudo(a.id, 'dur')) * 3.5; // 3〜6.5秒
  const delay = Math.abs(pseudo(a.id, 'delay')) * -dur; // 開始位置をずらす
  const wx = pseudo(a.id, 'x') * 16; // ±16px
  const wy = pseudo(a.id, 'y') * 8; // ±8px

  return (
    <div title={`${a.name}（${statusLabel(a)}）`}
      className="office-wander"
      style={{
        width: FRAME * 0.7, height: FRAME * 0.7, flexShrink: 0,
        // @ts-expect-error CSS変数
        '--wx': `${wx}px`, '--wy': `${wy}px`,
        animationDuration: `${dur}s`, animationDelay: `${delay}s`,
      }}
    >
      <div
        className="office-worker-idle"
        style={{
          width: FRAME * 0.7, height: FRAME * 0.7,
          backgroundImage: `url(${skin})`,
          backgroundSize: `${WORKER_SHEET_W * 0.7}px ${WORKER_SHEET_H * 0.7}px`,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

function Room({ floor, agents }: { floor: Floor; agents: AgentStatus[] }) {
  const working = agents.filter(a => a.status === 'working');
  const wandering = agents.filter(a => a.status !== 'working');

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #cfd6ce', marginBottom: 16, background: '#fff' }}>
      {/* 壁 */}
      <div style={{
        background: 'linear-gradient(#f6f3ea, #efe9da)', borderBottom: '3px solid #d8cfa8',
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <img src="/assets/office/room/picture.png" alt="" width={24} height={24} style={{ imageRendering: 'pixelated' }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: '#4a4536' }}>{floor.emoji} {floor.name.replace('（部長）', '')}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#00000010', color: '#665' }}>🪑 {agents.length}体</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
          background: working.length > 0 ? '#27AE6022' : '#00000010', color: working.length > 0 ? '#1E8449' : '#887',
        }}>⚡ 稼働中 {working.length}</span>
        <img src="/assets/office/room/cabinet.png" alt="" width={20} height={20} style={{ imageRendering: 'pixelated', marginLeft: 'auto' }} />
      </div>

      {/* 床：稼働中はデスク列、待機中はフロアをうろうろ */}
      <div style={{
        background: 'repeating-linear-gradient(90deg, #e9e4d6 0px, #e9e4d6 24px, #e2ddcd 24px, #e2ddcd 48px)',
        padding: '12px 10px', position: 'relative',
      }}>
        {working.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 8px', marginBottom: wandering.length > 0 ? 14 : 0, paddingBottom: wandering.length > 0 ? 12 : 0, borderBottom: wandering.length > 0 ? '2px dashed #d3ccb5' : undefined }}>
            {working.map(a => <DeskWorker key={a.id} a={a} />)}
          </div>
        )}
        {wandering.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <img src="/assets/office/room/plant.png" alt="" width={28} height={28} style={{ imageRendering: 'pixelated' }} />
            {wandering.map(a => <Wanderer key={a.id} a={a} />)}
          </div>
        )}
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

  const orderedFloors = [...floors].sort((a, b) => a.order - b.order).filter(f => (byFloor.get(f.id)?.length ?? 0) > 0);
  const totalWorking = agents.filter(a => a.status === 'working').length;

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#444' }}>🏢 ヒトマップビル（オフィス表示）</span>
        <span style={{ fontSize: 11, color: totalWorking > 0 ? '#1E8449' : '#999', fontWeight: 700 }}>
          全社員{agents.length}名・稼働中{totalWorking}名（残りはフロアを巡回中）
        </span>
      </div>

      {orderedFloors.map(floor => (
        <Room key={floor.id} floor={floor} agents={byFloor.get(floor.id) ?? []} />
      ))}

      <p style={{ fontSize: 9.5, color: '#bbb', marginTop: 6 }}>
        Office worker sprites by Solar Granulation（OpenGameArt.org, CC-BY 3.0/4.0）／ Room decor: Kenney Roguelike/RPG pack（CC0, kenney.nl）
      </p>
    </div>
  );
}
