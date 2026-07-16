'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 審査画面は運営ダッシュボードの「承認待ち」タブに統合された
export default function AdminReviewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/dashboard?tab=review');
  }, [router]);
  return null;
}
