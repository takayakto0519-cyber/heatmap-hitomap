// 運営がダッシュボードで保存した瞬間にサイトへ反映させるためのキャッシュ更新ヘルパー。
// 対象ページは少数なので、ブロック・サイト設定のどこを変えてもCMS対象ページを全部更新する
// （ページごとの出し分けを間違えて「保存したのに反映されない」が起きるより安全側に倒す）。
import { revalidatePath } from 'next/cache';
import { SITE_PAGES } from '@/lib/siteBlocks';

export function revalidateSitePages(): void {
  try {
    for (const p of SITE_PAGES) revalidatePath(p.path);
    revalidatePath('/');
  } catch {
    // ビルド環境によっては失敗しうるが、その場合も60秒のISRで反映されるため握りつぶす
  }
}
