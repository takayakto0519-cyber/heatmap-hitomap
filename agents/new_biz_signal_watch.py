"""新規事業仮説の種探しAI（50・10F 新規事業探索）— 新しい事業案そのものを考えるのはAI呼び出し
（Claude Codeセッション／new-biz-hypothesisスキル）の役目。この番人はその「材料」だけを
ルールベースで集めておく——痕跡投稿の「なぜ」欄でよく出てくる困りごとの言葉と、
ビジネスモデル案のうち長く動いていないものを拾い、次に考えるときの手掛かりにする。
LLM APIは使わずSupabase REST読み取りのみ。
"""
import json
import re
import urllib.request
from collections import Counter
from datetime import datetime, timezone

import common

STALE_DAYS = 30
STOPWORDS = {
    "こと", "もの", "ため", "よう", "これ", "それ", "あれ", "ここ", "そこ",
    "自分", "今日", "今回", "とき", "ところ", "みんな", "気持ち", "感じ",
}
WORD_RE = re.compile(r"[ぁ-んァ-ヶ一-龠a-zA-Z0-9]{2,}")


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read())


def main():
    with common.running("new_biz_signal_watch"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("new_biz_signal_watch", {"error": "Supabase設定(.env.local)が見つかりません"})
            return

        try:
            traces = _get(url, key, "traces?select=why&limit=3000&order=created_at.desc")
        except Exception as e:
            traces = []
            trace_error = str(e)
        else:
            trace_error = None

        try:
            ideas = _get(url, key, "biz_model_ideas?select=title,status,updated_at&limit=500")
        except Exception as e:
            ideas = []
            idea_error = str(e)
        else:
            idea_error = None

        # 「なぜ」欄の頻出語（困りごとの手掛かり）
        counter: Counter = Counter()
        for t in traces:
            why = (t.get("why") or "").strip()
            if not why:
                continue
            for word in WORD_RE.findall(why):
                if word in STOPWORDS:
                    continue
                counter[word] += 1
        top_keywords = [{"word": w, "count": n} for w, n in counter.most_common(15) if n >= 3]

        # 長く動いていないビジネスモデル案（次に育てるか見送るか判断する材料）
        now = datetime.now(timezone.utc)
        stale_ideas = []
        for idea in ideas:
            if idea.get("status") in ("done", "見送り", "rejected"):
                continue
            updated = idea.get("updated_at")
            if not updated:
                continue
            try:
                dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
            except Exception:
                continue
            days = (now - dt).days
            if days >= STALE_DAYS:
                stale_ideas.append({"title": idea.get("title", ""), "days_stale": days})
        stale_ideas.sort(key=lambda i: i["days_stale"], reverse=True)

        result = {
            "trace_sample_size": len(traces),
            "top_keywords": top_keywords,
            "idea_count": len(ideas),
            "stale_idea_count": len(stale_ideas),
            "stale_ideas": stale_ideas[:10],
        }
        if trace_error:
            result["trace_error"] = trace_error
        if idea_error:
            result["idea_error"] = idea_error
        common.write_result("new_biz_signal_watch", result)


if __name__ == "__main__":
    main()
