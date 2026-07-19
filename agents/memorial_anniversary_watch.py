"""追悼・周年史アーカイブAI（53・10F 新規事業探索）— 蓄積された歴史アーカイブ投稿
（archive_type: chimei地名由来／denshou伝承／bunken文献／koe声、memory_date記載あり）から、
今日・近日中に節目の年（10年・25年・50年・100年など）を迎えるものを見つける。
「その日にちなんだ発信」の種を探す装置。LLM APIは使わずSupabase REST読み取りのみ。
"""
import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone

import common

LOOKAHEAD_DAYS = 14  # これから2週間以内に節目を迎えるものを拾う
MILESTONE_YEARS = {5, 10, 15, 20, 25, 30, 33, 50, 60, 70, 88, 100, 150, 200, 250, 300, 500, 1000}

# YYYY-MM-DD / YYYY/MM/DD / YYYY年MM月DD日 のいずれかから年月日を取り出す
DATE_RE = re.compile(r"(\d{3,4})[-/年](\d{1,2})[-/月](\d{1,2})日?")


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read())


def _parse_memory_date(text: str) -> tuple[int, int, int] | None:
    m = DATE_RE.search(text or "")
    if not m:
        return None
    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return year, month, day


def main():
    with common.running("memorial_anniversary_watch"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("memorial_anniversary_watch", {"error": "Supabase設定(.env.local)が見つかりません"})
            return

        try:
            rows = _get(url, key,
                         "traces?select=id,title,memory_date,archive_type,era_label&archive_type=not.is.null&limit=3000")
        except Exception as e:
            common.write_result("memorial_anniversary_watch", {"error": f"取得エラー: {e}"})
            return

        today = datetime.now(timezone.utc).date()
        upcoming = []
        parsed_count = 0
        for r in rows:
            parsed = _parse_memory_date(r.get("memory_date") or "")
            if not parsed:
                continue
            parsed_count += 1
            year, month, day = parsed
            for lookahead in range(LOOKAHEAD_DAYS + 1):
                target = today + timedelta(days=lookahead)
                if target.month == month and target.day == day:
                    years_passed = target.year - year
                    if years_passed > 0 and years_passed in MILESTONE_YEARS:
                        upcoming.append({
                            "trace_id": r.get("id"), "title": r.get("title", ""),
                            "archive_type": r.get("archive_type"), "era_label": r.get("era_label"),
                            "anniversary_date": target.isoformat(), "years_passed": years_passed,
                            "days_until": lookahead,
                        })
                    break  # month/dayは年1回しか一致しないためこのレコードの探索は終了

        upcoming.sort(key=lambda u: u["days_until"])
        common.write_result("memorial_anniversary_watch", {
            "archive_total": len(rows),
            "date_parsed_count": parsed_count,
            "upcoming_count": len(upcoming),
            "upcoming": upcoming,
        })


if __name__ == "__main__":
    main()
