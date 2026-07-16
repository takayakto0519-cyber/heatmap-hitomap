"""不正投稿検知AI — 重複投稿・短時間バースト投稿をルールベースで検知する（読み取り専用）。
LLM APIは使わず、Supabase REST APIの読み取りとルールベース検知のみで完結させる。
"""
import json
import urllib.request
from collections import Counter

import common


def main():
    with common.running("spam_detect"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("spam_detect", {"error": "Supabase設定(.env.local)が見つかりません"})
            return

        req = urllib.request.Request(
            f"{url}/rest/v1/traces?select=id,title,session_code,created_at&order=created_at.desc&limit=200",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                traces = json.loads(res.read())
        except Exception as e:
            common.write_result("spam_detect", {"error": f"Supabase取得エラー: {e}"})
            return

        title_counts = Counter((t.get("title") or "").strip() for t in traces if t.get("title"))
        duplicate_titles = [
            {"title": title, "count": count}
            for title, count in title_counts.items() if count >= 3
        ]

        session_counts = Counter(t.get("session_code") for t in traces if t.get("session_code"))
        burst_sessions = [
            {"session_code": s, "count": c}
            for s, c in session_counts.items() if c >= 10
        ]

        common.write_result("spam_detect", {
            "checked": len(traces),
            "duplicate_title_count": len(duplicate_titles),
            "duplicate_titles": duplicate_titles,
            "burst_session_count": len(burst_sessions),
            "burst_sessions": burst_sessions,
        })


if __name__ == "__main__":
    main()
