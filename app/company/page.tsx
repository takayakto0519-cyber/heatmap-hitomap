import { redirect } from 'next/navigation';

// トップページの実装は app/page.tsx に一本化した（旧: このファイルとの二重管理で内容がずれる問題があった）。
export default function CompanyTopPage() {
  redirect('/');
}
