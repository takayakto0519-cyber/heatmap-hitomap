// 管理API（app/api/admin/*）で共通して使うヘルパー。
//
// このプロジェクトのマイグレーションは「SupabaseのSQL Editorで会長が手で適用する」運用のため、
// コードだけ先に出ていてテーブルがまだ無い、という状態が普通に起こる。そのとき生のPostgresエラーを
// 画面に出すと会長には何のことか分からないので、needsMigration を返して「このSQLを流してください」と
// 案内できるようにする。en-records と funding-opportunities に同じ関数がコピペされていたのをここへ集約した。

/** Supabaseのエラーメッセージが「そのテーブルがまだ無い」ことを示しているか */
export function isMissingTable(message: string, table: string): boolean {
  return message.includes(table) && (message.includes('does not exist') || message.includes('schema cache'));
}

/**
 * テーブル未作成時に返すペイロード。listKey には画面が期待する配列のキー名を渡す
 * （例: 'records' なら { ok:true, records:[], needsMigration:true, migrationFile } になる）。
 * 200で返すのは、画面を壊さず「SQL適用待ち」の案内だけ出させたいため。
 */
export function missingTablePayload(listKey: string, migrationFile: string) {
  return { ok: true as const, [listKey]: [], needsMigration: true as const, migrationFile };
}

/**
 * 件数取得を「失敗しても0」に落とす。
 * /api/admin/stats は app/admin/dashboard/page.tsx の tryUnlock() がログイン判定にも使っているため、
 * 未作成テーブルへのクエリが1本でも例外を投げると ok:false になり、会長がダッシュボードに入れなくなる。
 * バッジ用の集計をstatsに足すときは必ずこれで包むこと。
 */
export async function safeCount(
  run: () => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await run();
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * safeCount と同じ考え方で、行データを取ってから件数を数えたい場合に使う
 * （lib/followUp.ts の computeFollowUp のように、SQLのcountでは表現できない判定をサーバー側で回すとき）。
 */
export async function safeRows<T>(
  run: () => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}
