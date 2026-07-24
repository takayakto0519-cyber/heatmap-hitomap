"""スケジュール同期AI — 運営ダッシュボード「AIエージェント」タブで会長が変更した実行時刻
（agent_schedule_overrides テーブル）を、Windowsタスクスケジューラの実際のトリガー時刻に反映する。

ダッシュボードで時刻を変更しても、それだけではタスクスケジューラは変わらない
（Next.jsのAPIルートはこのPC上のタスクスケジューラを直接いじれないため）。
この番人が毎朝一番早く(05:00)動き、前日までの変更をまとめて反映することで、
「ダッシュボードで変えたら翌朝から反映される」という体験にする。

AI APIは使わない。Windows標準の schtasks.exe を呼ぶだけ。
"""
import json
import subprocess
import urllib.request

import common


def _task_name(agent_id: str) -> str:
    """agent_id（例: proposal_queue_watch）→ Windowsタスク名（例: HitomapProposalQueueWatch）。
    register_tasks.ps1 で使われている命名規則（Hitomap + PascalCase）と揃える。"""
    return "Hitomap" + "".join(w.capitalize() for w in agent_id.split("_"))


def main():
    with common.running("schedule_sync"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("schedule_sync", {"error": "Supabase設定(.env.local)が見つかりません"})
            return

        try:
            req = urllib.request.Request(
                f"{url}/rest/v1/agent_schedule_overrides?select=agent_id,time",
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
            )
            with urllib.request.urlopen(req, timeout=10) as res:
                overrides = json.loads(res.read())
        except Exception as e:
            common.write_result("schedule_sync", {"error": f"Supabase取得エラー: {e}"})
            return

        applied, failed = [], []
        for row in overrides:
            task_name = _task_name(row["agent_id"])
            try:
                result = subprocess.run(
                    ["schtasks", "/Change", "/TN", task_name, "/ST", row["time"]],
                    capture_output=True, text=True, timeout=30,
                )
                if result.returncode == 0:
                    applied.append({"agent_id": row["agent_id"], "task_name": task_name, "time": row["time"]})
                else:
                    failed.append({"agent_id": row["agent_id"], "task_name": task_name, "error": result.stderr.strip()[:200]})
            except Exception as e:
                failed.append({"agent_id": row["agent_id"], "task_name": task_name, "error": str(e)})

        common.write_result("schedule_sync", {
            "checked": len(overrides), "applied": applied, "failed": failed,
            "note": "会長がダッシュボードで変更した実行時刻をWindowsタスクスケジューラへ反映する専用の番人。AI不使用。",
        })


if __name__ == "__main__":
    main()
