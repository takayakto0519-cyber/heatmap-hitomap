"""燃え尽き検知番人（27）— gitのコミット時刻を調べ、深夜作業や連続稼働の兆候を検知する。
一人事業の最大リスクは会長のダウン。事業継続性＝収益継続性。
API不要・git logのみ・ルールベース。過去7日の 0〜5時コミット数と連続作業日数を見る。
"""
import subprocess
from collections import defaultdict
from datetime import datetime, timedelta

import common


def main():
    with common.running("burnout_watch"):
        try:
            out = subprocess.run(
                ["git", "log", "--since=14 days ago", "--pretty=format:%cI"],
                cwd=str(common.ROOT), capture_output=True, text=True, timeout=15,
            ).stdout
        except Exception as e:
            common.write_result("burnout_watch", {"error": f"git log 取得失敗: {e}"})
            return

        late_night = 0
        days = set()
        by_day = defaultdict(int)
        for line in out.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                # 例: 2026-07-18T02:13:44+09:00
                dt = datetime.fromisoformat(line)
            except ValueError:
                continue
            days.add(dt.date())
            by_day[dt.date()] += 1
            if 0 <= dt.hour < 5:
                late_night += 1

        # 連続作業日数（直近から遡って何日連続でコミットがあるか）
        streak = 0
        d = datetime.now().date()
        while d in days:
            streak += 1
            d = d - timedelta(days=1)

        warnings = []
        if late_night >= 3:
            warnings.append(f"直近2週間で深夜(0〜5時)のコミットが{late_night}回。眠れていますか。")
        if streak >= 7:
            warnings.append(f"{streak}日連続で作業しています。一日、何もしない日をください。")

        common.write_result("burnout_watch", {
            "late_night_commits_14d": late_night,
            "active_days_14d": len(days),
            "current_streak": streak,
            "warnings": warnings,
        })


if __name__ == "__main__":
    main()
