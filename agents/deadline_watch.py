"""課題締切トラッキングAI — 学生課題/締切.md を読み、締切が近い課題を検知する。
API不要・ローカルファイル解析のみ。書式: "- [ ] 課題名 | 締切: YYYY-MM-DD | 科目: ..."
"""
import re
from datetime import datetime
from pathlib import Path

import common

DEADLINE_FILE = common.ROOT / "学生課題" / "締切.md"
LINE_RE = re.compile(r"-\s*\[([ x])\]\s*(.+?)\s*\|\s*締切:\s*(\d{4}-\d{2}-\d{2})\s*(?:\|\s*科目:\s*(.+))?$")


def main():
    with common.running("deadline_watch"):
        tasks = []
        if DEADLINE_FILE.exists():
            for line in DEADLINE_FILE.read_text(encoding="utf-8").splitlines():
                m = LINE_RE.match(line.strip())
                if not m:
                    continue
                done, title, due, subject = m.groups()
                due_date = datetime.strptime(due, "%Y-%m-%d")
                days_left = (due_date - datetime.now()).days
                tasks.append({
                    "title": title.strip(),
                    "subject": (subject or "").strip(),
                    "due": due,
                    "days_left": days_left,
                    "done": done == "x",
                })
        pending = [t for t in tasks if not t["done"]]
        urgent = [t for t in pending if t["days_left"] <= 3]
        common.write_result("deadline_watch", {
            "file_exists": DEADLINE_FILE.exists(),
            "total": len(tasks),
            "pending_count": len(pending),
            "urgent_count": len(urgent),
            "urgent": sorted(urgent, key=lambda t: t["days_left"]),
            "pending": sorted(pending, key=lambda t: t["days_left"]),
        })


if __name__ == "__main__":
    main()
