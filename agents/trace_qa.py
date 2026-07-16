"""データ整合性夜間QA番人 — 痕跡・イベントデータの欠損を検知する（読み取り専用）。
LLM APIは使わず、Supabase REST APIの読み取りとルールベースの整合性チェックのみで完結させる。
"""
import json
import urllib.request

import common


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read())


def main():
    with common.running("trace_qa"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("trace_qa", {"error": "Supabase設定(.env.local)が見つかりません"})
            return

        issues = []
        try:
            traces = _get(url, key, "traces?select=id,title,photo_url,is_deleted&limit=1000")
            for t in traces:
                if not (t.get("title") or "").strip():
                    issues.append({"table": "traces", "id": t["id"], "issue": "タイトルが空"})
        except Exception as e:
            issues.append({"table": "traces", "issue": f"取得エラー: {e}"})

        try:
            events = _get(
                url, key,
                "routes?event_slug=not.is.null&select=id,event_slug,event_cover_url,event_starts_at&limit=500",
            )
            for e in events:
                if not e.get("event_cover_url"):
                    issues.append({"table": "routes(event)", "id": e["id"], "issue": f"OGP画像未設定 (slug: {e.get('event_slug')})"})
                if not e.get("event_starts_at"):
                    issues.append({"table": "routes(event)", "id": e["id"], "issue": f"開始日時未設定 (slug: {e.get('event_slug')})"})
        except Exception as e:
            issues.append({"table": "routes(event)", "issue": f"取得エラー: {e}"})

        common.write_result("trace_qa", {
            "issue_count": len(issues),
            "issues": issues,
        })


if __name__ == "__main__":
    main()
