"""スケジュール番人（25）— 案件カルテの next_action と 学生課題の締切を横断で集め、
「次にやること」を一枚に束ねる。API不要・ローカルファイルのみ・ルールベース。
顧問件数が増えても会長が約束を取りこぼさないための土台。
"""
from datetime import datetime

import common


def main():
    with common.running("schedule_watch"):
        cards = common.read_case_cards()
        actions = []
        for c in cards:
            na = c["fields"].get("next_action", "").strip()
            if na:
                actions.append({
                    "org_name": c["fields"].get("org_name", c["file"]),
                    "stage": c["fields"].get("stage", ""),
                    "next_action": na,
                    "updated": c["fields"].get("updated", ""),
                })

        # 学生課題の締切（deadline_watch と同じファイル）から緊急分を拾う
        deadlines = []
        dl = common.read_result("deadline_watch")
        if dl and dl.get("urgent"):
            for t in dl["urgent"]:
                deadlines.append({"title": t.get("title"), "due": t.get("due"), "days_left": t.get("days_left")})

        common.write_result("schedule_watch", {
            "action_count": len(actions),
            "actions": actions,
            "urgent_deadlines": deadlines,
            "as_of": datetime.now().strftime("%Y-%m-%d"),
        })


if __name__ == "__main__":
    main()
