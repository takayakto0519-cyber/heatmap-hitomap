'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// サイトCMSは運営ダッシュボードの「サイトCMS」タブに統合された。
// かつてここにあった独立実装は BlocksTab（複数ページ対応・ライブプレビュー付き）に置き換え済み。
// 旧URLをブックマークしている人のためにリダイレクトだけ残す。
export default function AdminBlocksRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/dashboard?tab=blocks');
  }, [router]);
  return null;
}
