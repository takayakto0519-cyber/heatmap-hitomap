// お題つきクエスト：週替わりで投稿のきっかけを作る。DBは使わず、週番号で決定論的にローテーションする
export interface Quest {
  emoji: string;
  title: string;
  hint: string;
}

export const QUESTS: Quest[] = [
  { emoji: '🪑', title: '直された跡を探そう', hint: '修理された椅子、継ぎ足された柱。直してでも使い続けた理由を想像してみてください' },
  { emoji: '🎨', title: '色あせたものを探そう', hint: '日に焼けた看板、擦り減った手すり。積み重なった時間が見える場所へ' },
  { emoji: '🌿', title: '誰かが育てているものを探そう', hint: '軒先の鉢植え、手入れされた生垣。世話をする人の気配を記録してください' },
  { emoji: '🚪', title: '古い看板・扉を探そう', hint: '昔のままの店構え、開かずの扉。その奥にあった暮らしを想像してみてください' },
  { emoji: '🧵', title: '手作りの工夫を探そう', hint: '手書きの張り紙、自作の柵。誰かの創意工夫が形になった場所へ' },
  { emoji: '🐾', title: 'いつもの生きものを探そう', hint: '軒下の猫、庭に来る鳥。その場所に根づいた小さな命を記録してください' },
  { emoji: '🕰', title: '変わらないものを探そう', hint: '何十年も同じ形のもの。変わらずにあり続ける理由を尋ねてみてください' },
  { emoji: '👣', title: 'すり減った道を探そう', hint: '踏み固められた近道、角の丸まった階段。誰かが通い続けた跡を記録してください' },
  { emoji: '📮', title: '待ち合わせ場所を探そう', hint: '誰かと約束した場所、目印になっている建物。その場所の役割を記録してください' },
  { emoji: '🌸', title: '季節を感じる場所を探そう', hint: '今の季節だけ表情を変える場所。今しか見られない痕跡を記録してください' },
];

// ISO週番号（1〜53）を計算し、お題配列のインデックスに変換する
function getIsoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getCurrentQuest(date: Date = new Date()): Quest {
  const week = getIsoWeekNumber(date);
  return QUESTS[week % QUESTS.length];
}
