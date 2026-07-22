"""番人稼働ヘルスチェックAI — 「タスクスケジューラに登録されている」と「実際に動いている」の
ギャップを検知する。2026-07-22、33体の番人が全てWindowsタスクスケジューラにState:Readyで
登録されているにもかかわらず、agents/work/xp.jsonの実行記録は7/18〜19の一括テストのみで
それ以降の稼働実績が確認できなかった事故を受けて新設。
ログオンモードが「対話型のみ」のタスクはPCが起動・ログインしていない時間帯は発火しないため、
このズレは今後も起きうる。LLM APIは使わず、xp.json/roster.generated.jsonの読み取りのみで完結。
"""
import json
from datetime import datetime, timedelta
from pathlib import Path

import common

STALE_THRESHOLD_HOURS = 36  # 毎日1回のスケジュールに対し、1日+半日のバッファ


def main():
    with common.running("roster_health_watch"):
        roster_path = common.AGENTS_DIR / "roster.generated.json"
        if not roster_path.exists():
            common.write_result("roster_health_watch", {"error": "roster.generated.jsonが見つかりません（node scripts/export-agent-roster.mjs を実行してください）"})
            return

        roster = json.loads(roster_path.read_text(encoding="utf-8"))
        scripts = roster.get("scripts", [])

        xp_path = common.WORK_DIR / "xp.json"
        xp = {}
        if xp_path.exists():
            try:
                xp = json.loads(xp_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass  # 破損している場合も本業(ヘルスチェック自体)は止めない

        now = datetime.now()
        never_run = []
        stale = []
        healthy = []

        for s in scripts:
            sid = s["id"]
            if sid == "roster_health_watch":
                continue  # 自分自身は対象外
            schedule = s.get("schedule", "")
            if "週" in schedule:
                threshold = timedelta(days=9)  # 週次番人は9日バッファ
            else:
                threshold = timedelta(hours=STALE_THRESHOLD_HOURS)

            rec = xp.get(sid)
            if not rec or not rec.get("last_run"):
                never_run.append({"id": sid, "name": s.get("name"), "schedule": schedule})
                continue
            try:
                last = datetime.fromisoformat(rec["last_run"])
            except ValueError:
                never_run.append({"id": sid, "name": s.get("name"), "schedule": schedule})
                continue
            if now - last > threshold:
                stale.append({
                    "id": sid, "name": s.get("name"), "schedule": schedule,
                    "last_run": rec["last_run"], "hours_since": round((now - last).total_seconds() / 3600, 1),
                })
            else:
                healthy.append(sid)

        common.write_result("roster_health_watch", {
            "total_scripts": len(scripts),
            "healthy_count": len(healthy),
            "stale_count": len(stale),
            "stale": sorted(stale, key=lambda x: -x["hours_since"]),
            "never_run_count": len(never_run),
            "never_run": never_run,
            "note": "stale/never_runは『登録されているが最近動いた記録がない』番人です。PCが対象時刻にログインしていなかった可能性が高いので、まずログイン状態を確認してください。",
        })


if __name__ == "__main__":
    main()
