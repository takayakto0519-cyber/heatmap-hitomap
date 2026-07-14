import { redirect } from 'next/navigation';

// 思想ページは内容を作り込み中のため、公開を一時停止する。
// 実装（TERMS・コピー等）はgit履歴に残しているので、再公開時はこのファイルを復元する。
export default function PhilosophyPage() {
  redirect('/');
}
