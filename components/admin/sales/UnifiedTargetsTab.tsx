'use client';

// 🧾 営業台帳 — 学校・法人（ClientLeadsTab）と関係人口・自治体（RelationPopulationTab）を
// 1つのサブビューに縦積みで並べる薄いラッパー。以前は🎓学校・法人／🔁関係人口・自治体／🧾送信キュー（統合）の
// 3つの別タブに分かれており、事実確認のたびに行き来する必要があった。
// 各タブ内部の実装（証拠パック・AI強化・提案書ドラフト・人口統計・SMOUT・RFP登録・事実確認・実送信）は
// そのまま2つのコンポーネントに残し、ここでは並べるだけにする（複雑な内部ロジックの二重実装を避ける）。
import ClientLeadsTab from '@/components/admin/ClientLeadsTab';
import RelationPopulationTab from '@/components/admin/RelationPopulationTab';

export default function UnifiedTargetsTab({ authHeaders, focusMunicipalityId, onFocusMunicipalityHandled }: {
  authHeaders: () => HeadersInit;
  focusMunicipalityId?: string | null;
  onFocusMunicipalityHandled?: () => void;
}) {
  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>🧾 営業台帳</p>
        <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#999', lineHeight: 1.7 }}>
          学校・法人と自治体を1画面にまとめました。証拠パック・出典の確認、事実確認、送信までここで完結します（送信は必ずボタンを押した時だけ・AIが自動で送ることはありません）。
        </p>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 800, color: '#444', margin: '0 0 10px' }}>🎓 学校・法人</h2>
      <ClientLeadsTab authHeaders={authHeaders} />

      <h2 style={{ fontSize: 14, fontWeight: 800, color: '#444', margin: '28px 0 10px' }}>🏛 関係人口・自治体</h2>
      <RelationPopulationTab authHeaders={authHeaders} focusProfileId={focusMunicipalityId} onFocusHandled={onFocusMunicipalityHandled} />
    </div>
  );
}
