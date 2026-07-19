"""UI改善A/Bテスト自動集計AI（79/48・9F データ・分析R&D）— ab_test_eventsに記録された
view/convertをtest_key×variant別に集計し、コンバージョン率を出す。
「感覚でなく数字で直す」ための装置。LLM APIは使わずSupabase REST読み取りのみ。
サイト側の計測コードがまだ無い間はテーブルが空でよく、その場合は静かにその旨を報告する。
"""
import json
import urllib.request
from collections import defaultdict

import common

# サンプル数がこれ未満の変化率は「参考程度」として明示する（誤読防止）
MIN_SAMPLE_FOR_CONFIDENCE = 30


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read())


def main():
    with common.running("ab_test_summary_watch"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("ab_test_summary_watch", {"error": "Supabase設定(.env.local)が見つかりません"})
            return
        try:
            rows = _get(url, key, "ab_test_events?select=test_key,variant,event_type&limit=20000")
        except Exception as e:
            msg = str(e)
            if "404" in msg or "does not exist" in msg or "schema cache" in msg:
                common.write_result("ab_test_summary_watch", {
                    "total": 0,
                    "note": "ab_test_eventsテーブルが未作成です。supabase/migrations/20260720_add_ab_test_events.sql をSQL Editorで実行してください",
                })
                return
            common.write_result("ab_test_summary_watch", {"error": f"取得エラー: {e}"})
            return

        if not rows:
            common.write_result("ab_test_summary_watch", {"total": 0, "note": "まだ計測データがありません（サイト側にview/convertの記録コードを仕込むと集計が始まります）"})
            return

        # test_key -> variant -> {"view": n, "convert": n}
        agg: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: {"view": 0, "convert": 0}))
        for r in rows:
            tk, variant, et = r.get("test_key"), r.get("variant"), r.get("event_type", "view")
            if not tk or not variant:
                continue
            if et not in ("view", "convert"):
                continue
            agg[tk][variant][et] += 1

        tests = []
        for test_key, variants in agg.items():
            variant_summaries = []
            for variant, counts in variants.items():
                views, converts = counts["view"], counts["convert"]
                rate = round(converts / views * 100, 1) if views else 0.0
                variant_summaries.append({
                    "variant": variant, "views": views, "converts": converts,
                    "conversion_rate": rate, "low_sample": views < MIN_SAMPLE_FOR_CONFIDENCE,
                })
            variant_summaries.sort(key=lambda v: v["conversion_rate"], reverse=True)
            leader = variant_summaries[0] if variant_summaries else None
            tests.append({
                "test_key": test_key,
                "variants": variant_summaries,
                "leader": leader["variant"] if leader else None,
                "leader_rate": leader["conversion_rate"] if leader else None,
                "any_low_sample": any(v["low_sample"] for v in variant_summaries),
            })
        tests.sort(key=lambda t: t["test_key"])

        common.write_result("ab_test_summary_watch", {
            "total": len(rows),
            "test_count": len(tests),
            "tests": tests,
        })


if __name__ == "__main__":
    main()
