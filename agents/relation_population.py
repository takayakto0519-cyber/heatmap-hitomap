"""関係人口ダッシュボードAI（63）— 痕跡(traces)から自治体向けの「関係人口」指標をルールベースで出す。
B2G商材の本体。LLM APIは使わずSupabase REST読み取りのみ。
関わった人（nickname）の数・複数回関わった人（＝関係人口の芽）・また来たいと答えた率を、実験回ごとに集計する。
"""
import json
import urllib.request
from collections import defaultdict

import common


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read())


def main():
    with common.running("relation_population"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("relation_population", {"error": "Supabase設定(.env.local)が見つかりません"})
            return
        try:
            rows = _get(url, key, "traces?select=nickname,session_code,want_revisit&limit=5000")
        except Exception as e:
            common.write_result("relation_population", {"error": f"取得エラー: {e}"})
            return

        # ニックネームごとに、関わった実験回の集合を作る
        person_sessions = defaultdict(set)
        revisit_people = set()
        for r in rows:
            nick = (r.get("nickname") or "").strip()
            if not nick:
                continue
            person_sessions[nick].add(r.get("session_code") or "unknown")
            if r.get("want_revisit"):
                revisit_people.add(nick)

        total_people = len(person_sessions)
        # 複数回（2つ以上の実験回）に関わった人＝関係人口の芽
        repeat_people = [p for p, s in person_sessions.items() if len(s) >= 2]

        common.write_result("relation_population", {
            "total_contributors": total_people,
            "repeat_contributors": len(repeat_people),
            "repeat_rate": round(len(repeat_people) / total_people * 100, 1) if total_people else 0,
            "want_revisit_people": len(revisit_people),
            "note": "複数の実験回に関わった人＝関係人口の芽。また来たいと答えた人＝関係の温度。",
        })


if __name__ == "__main__":
    main()
