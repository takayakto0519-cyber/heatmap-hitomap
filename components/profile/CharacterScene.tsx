'use client';

// 記録が育てるキャラクターの表示。SAGOJO（旅とシゴトのマッチングサイト）の
// 「背景シーン＋LV.＋EXPバー」ヘッダーを参考に、ヒトマップの色調（苔色・生成り）へ翻訳したもの。
// 画像アセットは使わず、インラインSVG＋絵文字のみで構成する（既存のバッジ・クエストと同じ流儀）。
import { useState } from 'react';
import type { CharacterState } from '@/lib/character';

const SCENE_SKY: Record<CharacterState['sceneVariant'], [string, string]> = {
  day: ['#CFE7E6', '#F3EFE1'],
  evening: ['#F3C89A', '#F6DFC4'],
  night: ['#2B3A55', '#3E4E6B'],
  sleep: ['#232B45', '#333F5C'],
};

const MOOD_LABEL: Record<CharacterState['mood'], string> = {
  awake: '元気いっぱい',
  sleepy: 'すこし眠そう',
  asleep: '眠っています',
  justWoke: 'おかえり！',
};

function SceneBackground({ variant, isMe }: { variant: CharacterState['sceneVariant']; isMe: boolean }) {
  const [skyTop, skyBottom] = SCENE_SKY[variant];
  const isDark = variant === 'night' || variant === 'sleep';
  return (
    <svg viewBox="0 0 400 130" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="hitomap-scene-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyTop} />
          <stop offset="100%" stopColor={skyBottom} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="400" height="130" fill="url(#hitomap-scene-sky)" />
      {isDark ? (
        <>
          <circle cx="60" cy="28" r="2" fill="#fff" opacity="0.8" />
          <circle cx="120" cy="18" r="1.4" fill="#fff" opacity="0.6" />
          <circle cx="200" cy="34" r="1.8" fill="#fff" opacity="0.7" />
          <circle cx="280" cy="16" r="1.4" fill="#fff" opacity="0.6" />
          <circle cx="340" cy="30" r="2" fill="#fff" opacity="0.8" />
          <circle cx="340" cy="42" r="14" fill="#F6EFD8" opacity="0.85" />
        </>
      ) : (
        <circle cx="350" cy="26" r="16" fill={variant === 'evening' ? '#F7A94A' : '#FDF3C8'} opacity="0.9" />
      )}
      {/* 苔色の丘（ヒトマップのaccent色） */}
      <path d="M0,95 Q100,60 200,90 T400,80 V130 H0 Z" fill={isDark ? '#3A4536' : '#7C9270'} opacity="0.55" />
      <path d="M0,110 Q120,85 220,108 T400,100 V130 H0 Z" fill={isDark ? '#2E3A2C' : '#566246'} opacity="0.9" />
      {/* 小道 */}
      <path d="M180,130 Q200,105 220,130 Z" fill={isDark ? '#4A4A42' : '#D7CFB8'} opacity="0.7" />
      {isMe && !isDark && (
        <>
          <circle cx="330" cy="100" r="6" fill="#fff" opacity="0.5" />
          <circle cx="342" cy="106" r="8" fill="#fff" opacity="0.5" />
          <circle cx="320" cy="108" r="5" fill="#fff" opacity="0.5" />
        </>
      )}
    </svg>
  );
}

export default function CharacterScene({
  character, compact = false, characterName, onRename,
}: {
  character: CharacterState;
  compact?: boolean;
  /** 会長がつけたキャラクター名。未設定ならステージ名を表示する */
  characterName?: string | null;
  /** 指定するとキャラ名の編集UI（✏️）を表示する（プロフィール本人ビューのみで渡す） */
  onRename?: (name: string) => Promise<void>;
}) {
  const height = compact ? 92 : 132;
  const charFontSize = compact ? 34 : 46;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(characterName ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onRename?.(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height, borderRadius: compact ? 12 : '16px 16px 0 0',
      overflow: 'hidden', marginBottom: compact ? 10 : 0,
    }}>
      <SceneBackground variant={character.sceneVariant} isMe={!compact} />

      {/* キャラ本体 */}
      <div style={{
        position: 'absolute', left: '50%', bottom: compact ? 10 : 16, transform: 'translateX(-50%)',
        textAlign: 'center', filter: character.mood === 'asleep' ? 'brightness(0.75)' : 'none',
      }}>
        <span style={{ fontSize: charFontSize, lineHeight: 1, display: 'block' }}>{character.emoji}</span>
        {character.mood === 'asleep' && <span style={{ fontSize: 14, position: 'relative', top: -8, left: 14 }}>💤</span>}
        {character.mood === 'justWoke' && <span style={{ fontSize: 14, position: 'relative', top: -10, left: 14 }}>✨</span>}
        {!compact && characterName && (
          <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
            {characterName}
          </p>
        )}
      </div>

      {!compact && onRename && !editing && (
        <button onClick={() => { setDraft(characterName ?? ''); setEditing(true); }} style={{
          position: 'absolute', bottom: 8, left: 12, fontSize: 10.5, fontWeight: 700, color: '#fff',
          background: 'rgba(35,35,31,0.45)', border: 'none', borderRadius: 999, padding: '3px 9px', cursor: 'pointer',
        }}>
          ✏️ {characterName ? '名前を変える' : '名前をつける'}
        </button>
      )}
      {!compact && editing && (
        <div style={{
          position: 'absolute', bottom: 6, left: 12, display: 'flex', gap: 4, alignItems: 'center',
          background: 'rgba(35,35,31,0.55)', borderRadius: 10, padding: 4,
        }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={20}
            placeholder="キャラの名前"
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: 'none', width: 100 }}
          />
          <button onClick={save} disabled={saving} style={{
            fontSize: 11, fontWeight: 700, color: '#fff', background: '#38ADA9', border: 'none',
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
          }}>保存</button>
          <button onClick={() => setEditing(false)} style={{
            fontSize: 11, color: '#fff', background: 'none', border: 'none', cursor: 'pointer',
          }}>✕</button>
        </div>
      )}

      {/* ステージ・分岐ラベル */}
      <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10.5, fontWeight: 800, color: '#fff', background: 'rgba(35,35,31,0.45)',
          padding: '3px 9px', borderRadius: 999,
        }}>{character.stageLabel}{character.branchLabel ? `・${character.branchLabel}` : ''}</span>
      </div>

      {/* LV. と EXPバー（SAGOJO参考） */}
      <div style={{ position: 'absolute', top: compact ? 10 : 12, right: 12, textAlign: 'right' }}>
        <span style={{ fontSize: compact ? 20 : 26, fontWeight: 900, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>
          LV.{character.level}
        </span>
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 12, left: compact ? 80 : 140 }}>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.round(character.progress * 100)}%`, background: '#F6B93B',
            borderRadius: 999, transition: 'width 0.6s ease',
          }} />
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 9.5, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.35)', textAlign: 'right' }}>
          次のレベルまで {character.expToNext} EXP・{MOOD_LABEL[character.mood]}
        </p>
      </div>
    </div>
  );
}
