# ヒトマップ MVP — 1週間・5人の実験を回すための基盤

## 構成

```
supabase/migrations/20260614_init_traces.sql  ① DBスキーマ（traces + Storage + RLS）
lib/types.ts                                   ② 型定義 & APIインターフェース
lib/supabase/{client,server}.ts                Supabase接続
app/api/traces/route.ts                        投稿の受け口（POST / GET）
components/map/TraceMap.tsx                     ③ Leafletマップ（ピン表示）
components/report/TraceCard.tsx                 カード表示
app/report/page.tsx                            レポート用ダッシュボード
integrations/google-form-to-supabase.gs        Googleフォーム→Supabase 中継(GAS)
```

## セットアップ手順

1. **依存インストール**
   ```powershell
   npm install leaflet react-leaflet @supabase/supabase-js
   npm install -D @types/leaflet
   ```
2. **Supabase**：プロジェクト作成 → SQL Editor で `supabase/migrations/20260614_init_traces.sql` を実行
3. **環境変数** `.env.local`
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. `npm run dev` → `http://localhost:3000/report` でダッシュボード確認

## 実験の流れ（データ収集 → レポート）

1. **収集**：まずGoogleフォームで集める（アプリ未完成でも実験開始できる）。
   `integrations/google-form-to-supabase.gs` をフォームのスクリプトに設定し、
   送信時トリガーで Supabase の `traces` に自動投入。
2. **可視化**：`/report` が `traces` を読み、地図ピン＋カード一覧で表示。
   実験回コード（例 `ws-20260620`）で回ごとに絞り込み可能。
3. **納品**：そのままブラウザ印刷 / スクショで「地域理解レポート」の素案になる。

## 設計上の配慮

- **匿名性**：本名・メール・正確な個人特定情報は持たない。ニックネームは任意。
- **入力負荷の最小化**：必須は「タイトル＋位置」のみ。3つの問いと2つのBooleanは任意。
- **監視に見えない**：収集データは"場所×気づき"であり、人物追跡ではない。
- **差し替え可能**：地図はLeaflet（無料）。将来Mapboxへ差し替えても型は不変。
