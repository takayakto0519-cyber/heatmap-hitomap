'use client';

// 🏢 ドット絵オフィス表示 — AIエージェントの稼働状況を、部門ごとの「部屋」に机を並べた
// オフィスとして可視化する。キャラクター・PC・ウォータークーラーのスプライトは
// OpenGameArt.orgの "Office worker sprites"（作者：Solar Granulation、CC-BY 3.0/4.0）を使用。
// 稼働中(working)は腕を動かすアニメーション＋PC画面のスピナーが回り、待機中は静止する。
// 要注意（result.error等）が出ているエージェントはPC画面が赤く点灯する。
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

function hashSkin(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % SKINS.length;
}

function isAttention(result: Record<string, unknown> | null): boolean {
  if (!result) return false;
  if (result.error) return true;
  return false;
}

function Desk({ a }: { a: AgentStatus }) {
  const skin = SKINS[hashSkin(a.id)];
  const working = a.status === 'working';
  const attention = isAttention(a.result);

  return (
    <div title={`${a.name}（${a.status === 'working' ? '実行中' : a.status === 'synced' ? '同期済み' : '待機中'}）`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: FRAME + 10 }}>
      <div
        className={working ? 'office-monitor-working' : undefined}
        style={{
          width: FRAME, height: FRAME, flexShrink: 0,
          backgroundImage: 'url(/assets/office/ComputerSheet.png)',
          backgroundSize: `${COMPUTER_SHEET_W}px ${COMPUTER_SHEET_H}px`,
          backgroundPosition: attention ? `-${2 * FRAME}px -${7 * FRAME}px` : '0px 0px',
          imageRendering: 'pixelated',
        }}
      />
      <div
        className={working ? 'office-worker-working' : 'office-worker-idle'}
        style={{
          width: FRAME, height: FRAME, flexShrink: 0, marginTop: -6,
          backgroundImage: `url(${skin})`,
          backgroundSize: `${WORKER_SHEET_W}px ${WORKER_SHEET_H}px`,
          imageRendering: 'pixelated',
        }}
      />
      <span style={{ fontSize: 9, color: '#999', marginTop: 2, maxWidth: FRAME + 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {a.emoji}{a.name.replace(/^\d+\.\s*/, '').replace(/^👑\s*/, '')}
      </span>
    </div>
  );
}

function Room({ floor, agents }: { floor: Floor; agents: AgentStatus[] }) {
  const working = agents.filter(a => a.status === 'working').length;
  return (
    <div style={{ background: '#eef1ef', border: '1px solid #d6dad7', borderRadius: 10, padding: '12px 10px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#333' }}>{floor.emoji} {floor.name.replace('（部長）', '')}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#dfe3e0', color: '#666' }}>🪑 {agents.length}体</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
          background: working > 0 ? '#27AE6022' : '#dfe3e0', color: working > 0 ? '#1E8449' : '#999',
        }}>⚡ 稼働中 {working}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 8px' }}>
        {agents.map(a => <Desk key={a.id} a={a} />)}
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
        .office-worker-idle { animation: officeIdleBob 2.4s steps(1) infinite; }
        .office-worker-working { animation: officeWorkingType 0.6s steps(1) infinite; }
        .office-monitor-working { animation: officeMonitorSpin 1s steps(1) infinite; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#444' }}>🏢 ヒトマップビル（オフィス表示）</span>
        <span style={{ fontSize: 11, color: totalWorking > 0 ? '#1E8449' : '#999', fontWeight: 700 }}>
          全社員{agents.length}名・稼働中{totalWorking}名
        </span>
      </div>

      {orderedFloors.map(floor => (
        <Room key={floor.id} floor={floor} agents={byFloor.get(floor.id) ?? []} />
      ))}

      <p style={{ fontSize: 9.5, color: '#bbb', marginTop: 6 }}>
        Office worker sprites by Solar Granulation（OpenGameArt.org, CC-BY 3.0/4.0）
      </p>
    </div>
  );
}
