"""リード温度感スコアリングAI（4）— client_leads を読み、営業の当たる順を毎朝スコア化する。
API不要のLLMは使わず、Supabase REST 読み取り＋ルールベースのキーワード加点のみ。
熱いリードから当たれるよう、会長に順位を提示する材料を work/lead_temperature.json に出す。
"""
import json
import urllib.request

import common

# 証拠パック(memo)に含まれると「熱い」とみなすキーワードと加点
HOT_WORDS = {
    "実証実験": 30, "既存": 25, "縁": 20, "関係": 12,
    "補助金": 18, "公募": 12, "総合計画": 12, "指針": 10,
    "人材不足": 10, "人材確保": 8, "DX": 6, "AI導入": 8,
    "拠点": 8, "地理的に一致": 10, "横浜": 6,
}


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read())


def score_lead(lead: dict) -> tuple[int, list[str]]:
    memo = lead.get("memo") or ""
    score, hits = 0, []
    for w, pt in HOT_WORDS.items():
        if w in memo:
            score += pt
            hits.append(w)
    # 連絡先が既に分かっているものは動きやすい
    if lead.get("email") or lead.get("phone"):
        score += 15
        hits.append("連絡先あり")
    # ステータスがlead(初期)なら伸びしろ、商談中なら最優先
    if lead.get("status") in ("contacted", "negotiating", "meeting", "商談中"):
        score += 20
        hits.append("進行中")
    return score, hits


def main():
    with common.running("lead_temperature"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("lead_temperature", {"error": "Supabase設定(.env.local)が見つかりません"})
            return
        try:
            leads = _get(url, key, "client_leads?select=id,org_name,client_type,email,phone,status,memo&limit=500")
        except Exception as e:
            common.write_result("lead_temperature", {"error": f"取得エラー: {e}"})
            return

        scored = []
        for l in leads:
            s, hits = score_lead(l)
            temp = "🔥熱い" if s >= 45 else "🌤ふつう" if s >= 20 else "❄冷たい"
            scored.append({
                "org_name": l.get("org_name"),
                "score": s,
                "temp": temp,
                "reasons": hits,
            })
        scored.sort(key=lambda x: -x["score"])
        common.write_result("lead_temperature", {
            "total": len(scored),
            "hot_count": sum(1 for x in scored if x["score"] >= 45),
            "ranked": scored[:20],
        })


if __name__ == "__main__":
    main()
