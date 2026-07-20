"""稼働状況の同期AI — ローカルで動いているエージェント（agents/*.py）の最新結果を
Supabaseのagent_status_snapshotテーブルへ書き込む。
hitomap.com（本番・Vercel等）はこのPCのローカルファイルに直接アクセスできないため、
運営ダッシュボードの「稼働状況」タブは本番からアクセスされた場合、このテーブルを読む。
LLM APIは使わない。1時間おきに実行し、常に「最終同期」時点のスナップショットを保つ。

番人一覧の一次情報源は lib/agents/roster.ts（単一の真実の源）。
`node scripts/export-agent-roster.mjs` が書き出す agents/roster.generated.json を読む。
以前はここ・route.ts・agent-dashboard/server.py の3箇所で同じ配列を三重管理していた。
"""
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import common

# roster.generated.json（roster.ts由来）を読む。無ければ最小フォールバック。
_ROSTER_JSON = Path(__file__).resolve().parent / "roster.generated.json"


def _load_agents():
    try:
        data = json.loads(_ROSTER_JSON.read_text(encoding="utf-8"))
        scripts = data.get("scripts") or []
        if scripts:
            return [
                {"id": a["id"], "name": a["name"], "emoji": a["emoji"],
                 "floor": a["floor"], "schedule": a.get("schedule", "")}
                for a in scripts
            ]
    except Exception:
        pass
    # フォールバック：JSON未生成でも最低限動く（work/*.jsonが存在するidだけ拾う）
    return [
        {"id": p.stem, "name": p.stem, "emoji": "🤖", "floor": "A", "schedule": ""}
        for p in sorted(common.WORK_DIR.glob("*.json"))
        if p.stem not in ("xp",)
    ]


AGENTS = _load_agents()


def _xp_to_level(total: int) -> tuple[int, int]:
    return 1 + total // 5, total


def main():
    with common.running("sync_status_to_supabase"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            common.write_result("sync_status_to_supabase", {"error": "SUPABASE_SERVICE_ROLE_KEY(.env.local)が見つかりません"})
            return

        xp_data = common.read_result("xp") or {}
        # xp.jsonはwrite_result形式ではないため個別に読む
        xp_path = common.WORK_DIR / "xp.json"
        if xp_path.exists():
            try:
                xp_data = json.loads(xp_path.read_text(encoding="utf-8"))
            except Exception:
                xp_data = {}

        rows = []
        for meta in AGENTS:
            result = common.read_result(meta["id"])
            xp_rec = xp_data.get(meta["id"], {})
            level, xp = _xp_to_level(int(xp_rec.get("total", 0)))
            rows.append({
                "agent_id": meta["id"], "name": meta["name"], "emoji": meta["emoji"],
                "floor": meta["floor"], "schedule": meta["schedule"],
                "result": result, "generated_at": (result or {}).get("generated_at"),
                "level": level, "xp": xp, "synced_at": datetime.now(timezone.utc).isoformat(),
            })

        req = urllib.request.Request(
            f"{url}/rest/v1/agent_status_snapshot?on_conflict=agent_id",
            data=json.dumps(rows, ensure_ascii=False).encode("utf-8"),
            headers={
                "apikey": key, "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                status = res.status
        except Exception as e:
            common.write_result("sync_status_to_supabase", {"error": f"同期エラー: {e}", "row_count": len(rows)})
            return

        common.write_result("sync_status_to_supabase", {"synced_count": len(rows), "http_status": status})


if __name__ == "__main__":
    main()
