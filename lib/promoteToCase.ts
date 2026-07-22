// 台帳（自治体プロファイル／学校法人リード／返信キュー）から商流ボードへ「案件化する」共通ロジック。
// RelationPopulationTab・ClientLeadsTab・SalesTabの返信キューの3箇所から同じ関数を呼び、
// business_cases への重複作成（同じlead_ref/municipality_profile_idの案件が既にある）を防ぐ。

export interface PromoteSource {
  orgName: string;
  clientType: 'municipality' | 'business';
  leadRef?: string | null;
  municipalityProfileId?: string | null;
  evidence?: string | null;
}

interface ExistingCaseLike {
  id: string;
  lead_ref?: string | null;
  municipality_profile_id?: string | null;
}

/** 既存のbusiness_casesの中に、このsourceに対応する案件が既にあればそのidを返す */
export function findExistingCase(cases: ExistingCaseLike[], source: PromoteSource): string | null {
  const hit = cases.find((c) => {
    if (source.leadRef && c.lead_ref === source.leadRef) return true;
    if (source.municipalityProfileId && c.municipality_profile_id === source.municipalityProfileId) return true;
    return false;
  });
  return hit?.id ?? null;
}

/**
 * 案件化する。既に対応する案件があればそのidをそのまま返し（重複作成しない）、
 * 無ければ stage='提案' で新規作成してidを返す。
 * password は呼び出し元のadmin_dashboard_passwordをそのまま渡す。
 */
export async function promoteToCase(
  source: PromoteSource,
  existingCases: ExistingCaseLike[],
  password: string,
): Promise<{ ok: boolean; caseId?: string; created?: boolean; error?: string }> {
  const existingId = findExistingCase(existingCases, source);
  if (existingId) return { ok: true, caseId: existingId, created: false };

  try {
    const res = await fetch('/api/admin/business-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({
        org_name: source.orgName,
        client_type: source.clientType,
        stage: '提案',
        evidence: source.evidence || null,
        lead_ref: source.leadRef || null,
        municipality_profile_id: source.municipalityProfileId || null,
      }),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.error || '案件化に失敗しました' };
    return { ok: true, caseId: json.case.id, created: true };
  } catch {
    return { ok: false, error: '通信エラーが発生しました' };
  }
}
