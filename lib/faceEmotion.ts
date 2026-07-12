// 表情推定 → ヒトマップの感情タグへのマッピング。
// app/experiments/face-emotion で検証した classify() のロジックを本体機能向けに整理したもの。
// カメラ映像は解析後すぐに破棄し、どこにも送信しない（端末内で完結）という前提はそのまま引き継ぐ。

export type FaceReading = {
  emoji: string;
  label: string;
  suggestedKeys: string[]; // lib/emotions.ts の EMOTIONS.key。強い順。
};

const NEUTRAL: FaceReading = { emoji: '😐', label: 'おだやか', suggestedKeys: [] };

export function classifyFace(scores: Record<string, number>): FaceReading {
  const smile = ((scores.mouthSmileLeft ?? 0) + (scores.mouthSmileRight ?? 0)) / 2;
  const surprise = ((scores.browInnerUp ?? 0) + (scores.eyeWideLeft ?? 0) + (scores.eyeWideRight ?? 0) + (scores.jawOpen ?? 0)) / 4;
  const frown = ((scores.browDownLeft ?? 0) + (scores.browDownRight ?? 0) + (scores.mouthFrownLeft ?? 0) + (scores.mouthFrownRight ?? 0)) / 4;

  if (smile > 0.4 && smile >= surprise && smile >= frown) {
    return { emoji: '😊', label: 'うれしそう', suggestedKeys: ['tokimeki', 'tanoshisa'] };
  }
  if (surprise > 0.4 && surprise > frown) {
    return { emoji: '😲', label: 'おどろいてそう', suggestedKeys: ['odoroki', 'kandou'] };
  }
  if (frown > 0.3) {
    return { emoji: '😟', label: 'こまってそう', suggestedKeys: ['setsunai'] };
  }
  return NEUTRAL;
}

export const FACE_EMOTION_DWELL_SECONDS = 1.5; // この秒数、同じ表情が続いたら「本人の感情」として採用する
