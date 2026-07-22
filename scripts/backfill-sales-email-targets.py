"""1回限りのバックフィルスクリプト（P0-1）— sales_email_targetsのデータをclient_leadsへ統合する。

前提：supabase/migrations/20260723_merge_sales_email_targets_into_client_leads.sql が
Supabase SQL Editorで適用済みであること（client_leadsにhook/drafted/sent列が存在すること）。

方針：
- sales_email_targets の各行を org_name(company) で client_leads と突き合わせる
- 一致する client_leads 行があれば、client_leads側が空の項目だけ sales_email_targets の値で埋める
  （client_leads側に既にある値は上書きしない＝会長が確認した値を保護する）
- 一致する client_leads 行が無ければ、新規に client_leads へ挿入する（client_type='business'）
- sales_email_targets テーブル自体は削除しない（当面は凍結データとして残す）

実行方法：
  cd agents  # または任意の場所
  python ../scripts/backfill-sales-email-targets.py
"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env_local() -> dict:
    env = {}
    env_path = ROOT / ".env.local"
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def request(method: str, url: str, key: str, body: dict | None = None) -> tuple[int, bytes]:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def main():
    env = load_env_local()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("エラー: .env.localにSupabase設定が見つかりません")
        sys.exit(1)

    code, body = request("GET", f"{url}/rest/v1/client_leads?select=id,hook&limit=1", key)
    if code == 400 and b"hook" in body:
        print("エラー: client_leads.hook列がまだ存在しません。先にマイグレーション")
        print("  supabase/migrations/20260723_merge_sales_email_targets_into_client_leads.sql")
        print("をSupabase SQL Editorで適用してください。")
        sys.exit(1)

    code, cl_raw = request("GET", f"{url}/rest/v1/client_leads?select=*", key)
    client_leads = json.loads(cl_raw)
    code, set_raw = request("GET", f"{url}/rest/v1/sales_email_targets?select=*", key)
    sales_targets = json.loads(set_raw)

    print(f"client_leads: {len(client_leads)}件, sales_email_targets: {len(sales_targets)}件")

    by_org = {row["org_name"]: row for row in client_leads}

    merged, created, skipped = 0, 0, 0
    for t in sales_targets:
        match = by_org.get(t["company"])
        if match:
            patch = {}
            # client_leads側が空のときだけ埋める（会長が既に確認した値は上書きしない）
            for field in ["email", "website_url", "contact_email_confidence", "contact_email_source_url",
                          "email_draft", "fact_check_status", "fact_check_note", "fact_checked_at"]:
                if not match.get(field) and t.get(field):
                    patch[field] = t[field]
            # hook/drafted/sentは常にsales_email_targets側の値を反映する（client_leads側は初期値のため）
            patch["hook"] = t.get("hook")
            patch["drafted"] = bool(t.get("drafted"))
            patch["sent"] = bool(t.get("sent"))
            if not match.get("email_sent_at") and t.get("email_sent_at"):
                patch["email_sent_at"] = t["email_sent_at"]
            if not match.get("email_reply") and t.get("email_reply"):
                patch["email_reply"] = t["email_reply"]
            if not match.get("followed_up_at") and t.get("followed_up_at"):
                patch["followed_up_at"] = t["followed_up_at"]

            code, resp = request("PATCH", f"{url}/rest/v1/client_leads?id=eq.{match['id']}", key, patch)
            if code in (200, 204):
                merged += 1
                print(f"  統合: {t['company']} -> client_leads/{match['id']}")
            else:
                print(f"  失敗: {t['company']} ({code}) {resp[:200]}")
        else:
            insert = {
                "client_type": "business", "org_name": t["company"], "email": t.get("email"),
                "hook": t.get("hook"), "drafted": bool(t.get("drafted")), "sent": bool(t.get("sent")),
                "website_url": t.get("website_url"), "contact_email_confidence": t.get("contact_email_confidence"),
                "contact_email_source_url": t.get("contact_email_source_url"), "email_draft": t.get("email_draft"),
                "fact_check_status": t.get("fact_check_status"), "fact_check_note": t.get("fact_check_note"),
                "fact_checked_at": t.get("fact_checked_at"), "email_sent_at": t.get("email_sent_at"),
                "email_reply": t.get("email_reply"), "followed_up_at": t.get("followed_up_at"),
            }
            code, resp = request("POST", f"{url}/rest/v1/client_leads", key, insert)
            if code == 201:
                created += 1
                print(f"  新規作成: {t['company']}")
            else:
                print(f"  失敗: {t['company']} ({code}) {resp[:200]}")

    print(f"\n完了: 統合{merged}件・新規作成{created}件・スキップ{skipped}件")
    print("sales_email_targetsテーブル自体は削除していません（凍結データとして残ります）。")


if __name__ == "__main__":
    main()
