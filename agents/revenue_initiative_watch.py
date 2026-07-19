"""収益化イニシアチブ番人 — 01_経営幹部_Executive/収益化イニシアチブ.md を読み、
14日以上更新のない施策（止まっている施策）を検知する。
API不要・ローカルファイル解析のみ。書式: "- [ ] 施策名 | ステージ: ... | 更新: YYYY-MM-DD | 次アクション: ..."
"""
import re
from datetime import datetime

import common

FILE = common.ROOT / "01_経営幹部_Executive" / "収益化イニシアチブ.md"
STALE_DAYS = 14
LINE_RE = re.compile(
    r"-\s*\[([ x])\]\s*(.+?)\s*\|\s*ステージ:\s*(.+?)\s*\|\s*更新:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*次アクション:\s*(.+)$"
)


def main():
    with common.running("revenue_initiative_watch"):
        items = []
        if FILE.exists():
            for line in FILE.read_text(encoding="utf-8").splitlines():
                m = LINE_RE.match(line.strip())
                if not m:
                    continue
                done, title, stage, updated, next_action = m.groups()
                updated_date = datetime.strptime(updated, "%Y-%m-%d")
                age_days = round((datetime.now() - updated_date).total_seconds() / 86400, 1)
                items.append({
                    "title": title.strip(),
                    "stage": stage.strip(),
                    "updated": updated,
                    "age_days": age_days,
                    "next_action": next_action.strip(),
                    "done": done == "x",
                })

        active = [i for i in items if not i["done"]]
        stale = [i for i in active if i["age_days"] >= STALE_DAYS]
        common.write_result("revenue_initiative_watch", {
            "file_exists": FILE.exists(),
            "total": len(items),
            "active_count": len(active),
            "done_count": len(items) - len(active),
            "stale_count": len(stale),
            "stale": sorted(stale, key=lambda i: -i["age_days"]),
            "active": sorted(active, key=lambda i: -i["age_days"]),
        })


if __name__ == "__main__":
    main()
