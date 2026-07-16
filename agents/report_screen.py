"""通報一次スクリーニングAI — 通報キューをキーワードルールで一次分類する（読み取り専用）。
削除・却下は一切実行しない。「suggested_action」を提示するのみで、最終判断は加藤会長が管理画面で行う。
LLM APIは使わず、Supabase REST APIの読み取りとルールベース分類のみで完結させる。
"""
import json
import urllib.request

import common

SPAM_KEYWORDS = ["http://", "https://", "副業", "儲かる", "LINE@", "出会い系", "今すぐクリック", "稼げる"]
PII_KEYWORDS = ["電話番号", "住所特定", "本名", "個人情報", "特定できる"]


def classify(reason: str, note: str | None) -> str:
    text = f"{reason} {note or ''}"
    if any(k in text for k in SPAM_KEYWORDS):
        return "要削除候補（スパム/広告の疑い）"
    if any(k in text for k in PII_KEYWORDS):
        return "要削除候補（個人情報の疑い）"
    return "グレー（人間の判断が必要）"


def main():
    with common.running("report_screen"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("report_screen", {"error": "Supabase設定(.env.local)が見つかりません"})
            return
        req = urllib.request.Request(
            f"{url}/rest/v1/trace_reports?status=eq.pending&select=*&order=created_at.desc",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                reports = json.loads(res.read())
        except Exception as e:
            common.write_result("report_screen", {"error": f"Supabase取得エラー: {e}"})
            return

        screened = [
            {**r, "suggested_action": classify(r.get("reason", ""), r.get("note"))}
            for r in reports
        ]
        common.write_result("report_screen", {
            "pending_count": len(screened),
            "spam_suspected": sum(1 for r in screened if "スパム" in r["suggested_action"]),
            "pii_suspected": sum(1 for r in screened if "個人情報" in r["suggested_action"]),
            "gray": sum(1 for r in screened if "グレー" in r["suggested_action"]),
            "reports": screened,
        })


if __name__ == "__main__":
    main()
