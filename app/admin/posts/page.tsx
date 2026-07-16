'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 実績ブログの編集は運営ダッシュボードの「実績ブログ」タブに統合された。
// かつてここにあった独立実装は PostsTab（post_type・関連ブログ・ライブプレビュー対応）に置き換え済み。
// 旧URLをブックマークしている人のためにリダイレクトだけ残す。
export default function AdminPostsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/dashboard?tab=posts');
  }, [router]);
  return null;
}
