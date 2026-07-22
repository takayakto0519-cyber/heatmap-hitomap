"""収益化イニシアチブ番人 — Supabaseのrevenue_initiativesテーブルを読み、
14日以上更新のない施策（止まっている施策）を検知する。

以前は 01_経営幹部_Executive/収益化イニシアチブ.md をローカルの真実の源としていたが、
運営ダッシュボードの「収益・損益」タブは Supabase の revenue_initiatives テーブルを見ており、
ダッシュボードで追加・更新した施策がこの番人には一切反映されない二重管理になっていた。
DBを単一の真実の源にするため、sync_status_to_supabase.py と同じ「.env.localを読んで
PostgRESTへ素のHTTPで叩く」流儀でSupabaseを直接読む（書き込みはしない・監視のみ）。
"""
import json
import urllib.request
from datetime import datetime, timezone

import common

STALE_DAYS = 14


def main():
    with common.running("revenue_initiative_watch"):
        env = common.load_env_local()
        if not env.get("NEXT_PUBLIC_SUPABASE_URL") or not env.get("SUPABASE_SERVICE_ROLE_KEY"):
            common.write_result("revenue_initiative_watch", {"error": "SUPABASE_SERVICE_ROLE_KEY(.env.local)が見つかりません"})
            return

        req = urllib.request.Request(
            f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/revenue_initiatives?select=title,code,stage,next_action,updated_at",
            headers={
                "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
                "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                rows = json.loads(res.read()) if res.status == 200 else []
        except Exception as e:
            common.write_result("revenue_initiative_watch", {"error": f"revenue_initiatives 取得失敗: {e}"})
            return

        now = datetime.now(timezone.utc)
        items = []
        for r in rows:
            updated_at = r.get("updated_at")
            age_days = round((now - datetime.fromisoformat(updated_at.replace("Z", "+00:00"))).total_seconds() / 86400, 1) if updated_at else None
            items.append({
                "title": r.get("title", ""), "code": r.get("code"),
                "stage": r.get("stage", ""), "updated": updated_at,
                "age_days": age_days, "next_action": r.get("next_action") or "",
                "done": r.get("stage") == "完了",
            })

        active = [i for i in items if not i["done"]]
        stale = [i for i in active if i["age_days"] is not None and i["age_days"] >= STALE_DAYS]
        common.write_result("revenue_initiative_watch", {
            "total": len(items),
            "active_count": len(active),
            "done_count": len(items) - len(active),
            "stale_count": len(stale),
            "stale": sorted(stale, key=lambda i: -i["age_days"]),
            "active": sorted(active, key=lambda i: -(i["age_days"] or 0)),
        })


if __name__ == "__main__":
    main()
