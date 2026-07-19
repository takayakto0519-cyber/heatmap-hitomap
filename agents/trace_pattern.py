"""痕跡データパターン分析AI（62）— 蓄積された痕跡(traces)の傾向をルールベースで集計する。
自治体向けレポート商品の中身（数字）を作る装置。LLM APIは使わずSupabase REST読み取りのみ。
投稿時間帯・また来たい率・話したい率・実験回ごとの数・書き込みの厚み（3つの問いの記入率）を出す。
"""
import json
import urllib.request
from collections import Counter
from datetime import datetime

import common


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read())


def main():
    with common.running("trace_pattern"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("trace_pattern", {"error": "Supabase設定(.env.local)が見つかりません"})
            return
        try:
            rows = _get(url, key,
                        "traces?select=created_at,why,interpretation,self_reflection,want_revisit,want_to_share,session_code,nickname&limit=5000")
        except Exception as e:
            common.write_result("trace_pattern", {"error": f"取得エラー: {e}"})
            return

        total = len(rows)
        if total == 0:
            common.write_result("trace_pattern", {"total": 0, "note": "まだ痕跡がありません"})
            return

        hours = Counter()
        revisit = share = 0
        deep = 0  # 3つの問いを全部書いた濃い痕跡
        sessions = Counter()
        for r in rows:
            ca = r.get("created_at", "")
            try:
                hours[datetime.fromisoformat(ca.replace("Z", "+00:00")).hour] += 1
            except Exception:
                pass
            if r.get("want_revisit"):
                revisit += 1
            if r.get("want_to_share"):
                share += 1
            if (r.get("why") and r.get("interpretation") and r.get("self_reflection")):
                deep += 1
            if r.get("session_code"):
                sessions[r["session_code"]] += 1

        peak_hours = [f"{h}時({n})" for h, n in hours.most_common(3)]
        common.write_result("trace_pattern", {
            "total": total,
            "want_revisit_rate": round(revisit / total * 100, 1),
            "want_to_share_rate": round(share / total * 100, 1),
            "deep_write_rate": round(deep / total * 100, 1),
            "peak_hours": peak_hours,
            "top_sessions": sessions.most_common(5),
        })


if __name__ == "__main__":
    main()
