// 地域×アーカイブの投稿タイプ：地名・言い伝え・文献・人の声
// archive_type が null の投稿は従来の「痕跡」
export const ARCHIVE_TYPES = [
  {
    key: 'chimei', label: '地名', emoji: '🏷️', color: '#2E86C1',
    titleLabel: 'この土地の呼び名', titlePlaceholder: '例：どんど焼き場、権兵衛坂…',
    bodyLabel: 'この地名について知っていること', bodyPlaceholder: '由来、いつ頃までの呼び名か、誰から聞いたか…',
  },
  {
    key: 'denshou', label: '言い伝え', emoji: '📜', color: '#8E44AD',
    titleLabel: '言い伝え・習俗の名前', titlePlaceholder: '例：狐の嫁入りの話、雨乞いの祭り…',
    bodyLabel: 'どんな言い伝え・習俗か', bodyPlaceholder: '内容、誰から聞いたか、いつ頃まで行われていたか…',
  },
  {
    key: 'bunken', label: '文献', emoji: '📚', color: '#B7791F',
    titleLabel: '文献・資料の題名', titlePlaceholder: '例：〇〇村誌、△△家文書…',
    bodyLabel: 'この土地とのつながり', bodyPlaceholder: 'この文献に何が書かれているか、なぜこの場所に関わるか…',
  },
  {
    key: 'koe', label: '人の声', emoji: '🗣️', color: '#27AE60',
    titleLabel: '声の見出し', titlePlaceholder: '例：ここに製糸工場があった頃の話…',
    bodyLabel: '語られた内容', bodyPlaceholder: '聞いた話・自分の体験をそのまま書いてください',
  },
] as const;

export type ArchiveTypeKey = typeof ARCHIVE_TYPES[number]['key'];

export function getArchiveType(key: string | null | undefined) {
  return ARCHIVE_TYPES.find(t => t.key === key) ?? null;
}

// 「人の声」の語り手と土地の関係
export const VOICE_RELATIONS = [
  { key: 'resident',        label: '住んでいる' },
  { key: 'former_resident', label: '住んでいた' },
  { key: 'visitor',         label: '行ったことがある' },
  { key: 'heard',           label: '聞いた話' },
] as const;

export function getVoiceRelation(key: string | null | undefined) {
  return VOICE_RELATIONS.find(r => r.key === key) ?? null;
}
