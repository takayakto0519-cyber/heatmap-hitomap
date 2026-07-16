"""財務・事業ダッシュボードAI要約 — 3事業（プロダクト運用・affiliate-auto・moomoo）の運用状況を1枚に集約する。
LLM APIは使わず、Supabase REST・ローカルファイル・プロセス生死判定のみで完結させる。
moomooの実損益はバックエンドAPI未接続のため取得しない（数字を捏造しない。プロセス稼働状況のみ報告する）。
"""
import json
import subprocess
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

import common

MOOMOO_WORK = Path(r"C:\Users\takaya\Documents\Codex\2026-06-01\moomoo-api-ai-1-ai-web\work")
AFFILIATE_RESULTS = common.ROOT / "affiliate-auto" / "results.json"


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read())


def _product_snapshot(env: dict) -> dict:
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        return {"error": "Supabase設定が見つかりません"}
    try:
        traces = _get(url, key, "traces?select=id,created_at&limit=2000")
    except Exception as e:
        return {"error": f"取得エラー: {e}"}
    week_ago = (datetime.now() - timedelta(days=7)).isoformat()
    new_this_week = sum(1 for t in traces if (t.get("created_at") or "") >= week_ago)
    return {"total_traces": len(traces), "new_this_week": new_this_week}


def _affiliate_snapshot() -> dict:
    if not AFFILIATE_RESULTS.exists():
        return {"runs_logged": 0}
    try:
        data = json.loads(AFFILIATE_RESULTS.read_text(encoding="utf-8"))
    except Exception:
        return {"runs_logged": 0}
    week_ago = datetime.now() - timedelta(days=7)
    runs_this_week = 0
    articles_this_week = 0
    for batch in data:
        try:
            batch_date = datetime.strptime(batch["date"][:10], "%Y-%m-%d")
        except Exception:
            continue
        if batch_date >= week_ago:
            runs_this_week += 1
            articles_this_week += len(batch.get("entries", []))
    return {
        "runs_logged": len(data),
        "runs_this_week": runs_this_week,
        "articles_this_week": articles_this_week,
        "last_run": data[0].get("date") if data else None,
    }


def _moomoo_snapshot() -> dict:
    if not MOOMOO_WORK.exists():
        return {"reachable": False}
    try:
        out = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True, timeout=5).stdout
        live_pids = {line.split('","')[1] for line in out.splitlines() if '","' in line}
    except Exception:
        live_pids = set()
    pid_files = list(MOOMOO_WORK.glob("*.pid"))
    alive = 0
    for pf in pid_files:
        pid = pf.read_text(encoding="utf-8").strip()
        if pid and pid in live_pids:
            alive += 1
    return {
        "reachable": True,
        "processes_total": len(pid_files),
        "processes_alive": alive,
        "note": "実損益はバックエンドAPI未接続のため取得していません（数字の捏造を避けるため）",
    }


def main():
    with common.running("financial_snapshot"):
        env = common.load_env_local()
        common.write_result("financial_snapshot", {
            "product": _product_snapshot(env),
            "affiliate": _affiliate_snapshot(),
            "moomoo": _moomoo_snapshot(),
        })


if __name__ == "__main__":
    main()
