"""AI社長「日次・社長メモ」— command_center（統合司令室AI）とaction_items_digest（作業状況デイリー報告）
の最新結果を読み、全部門の要注意を1本化したうえで「今日いちばん重要な1件」だけをトリアージし、
短い社長メモとしてDiscordへ1日1回投げる。全件の羅列はしない（会長の負荷を増やさないため）。
LLM APIは使わずローカルのwork/*.json読み取りのみ。command_center.py・action_items_digest.pyより後に
実行すること（register_tasks.ps1で09:40に登録）。
"""
import json
import re
import urllib.request

import common

# 優先度が高い順。command_centerのattention_items（agent_id単位）をこの順で並べ、
# 同じ優先度なら見出し文中の数字（件数）が大きいものを先に出す。
PRIORITY_ORDER = [
    "action_items_digest",   # 会長に直接宛てたTo-Do最優先
    "approval_watch",        # 送信待ちの下書き（放置すると機会損失）
    "payment_watch",         # 未入金
    "case_pipeline_watch",   # 案件停滞
    "revenue_initiative_watch",
    "deadline_watch",
    "report_screen",
    "spam_detect",
    "trace_qa",
    "competitor_feature_monitor",
    "memorial_anniversary_watch",
]


def _extract_count(headline: str) -> int:
    m = re.search(r"(\d+)\s*件", headline)
    return int(m.group(1)) if m else 0


def _pick_top(attention_items: list[dict]) -> dict | None:
    if not attention_items:
        return None
    ranked = sorted(attention_items, key=lambda i: (i["agent_id"] not in PRIORITY_ORDER,
                                                     PRIORITY_ORDER.index(i["agent_id"]) if i["agent_id"] in PRIORITY_ORDER else 999,
                                                     -_extract_count(i["headline"])))
    return ranked[0]


def _compose_memo(cc: dict, top: dict | None, floors: list[dict]) -> str:
    attention_count = cc.get("attention_count", 0)
    if not top:
        return "全部門、平常運転。放置している火種はない。今日は次の一手を考える日にしていい。"

    floor_name = next((f["floor_name"] for f in floors if f["floor_id"] == top["floor"]), top["floor"])
    lines = [
        f"**{floor_name}**：{top['headline']}",
        "",
        f"他の要注意は{max(attention_count - 1, 0)}件。だが今日はこれ1つに絞る。全部を追うと、結局どれも終わらない。",
        "",
        "これは今日、着手できるか？",
    ]
    return "\n".join(lines)


def _send_discord_message(webhook_url: str, content: str, embed: dict) -> int:
    payload = {"username": "AI社長", "content": content, "embeds": [embed]}
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "HitomapShachoMemoDaily/1.0 (+https://github.com/hitomap)",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return res.status


def main():
    with common.running("shacho_memo_daily"):
        cc = common.read_result("command_center")
        if cc is None:
            common.write_result("shacho_memo_daily", {"error": "command_centerの結果がありません（先にcommand_center.pyを実行）"})
            return

        attention_items = cc.get("attention_items", [])
        floors = cc.get("floors", [])
        top = _pick_top(attention_items)
        memo_body = _compose_memo(cc, top, floors)

        env = common.load_env_local()
        webhook_url = env.get("HITOMAP_DISCORD_WEBHOOK_URL") or env.get("DISCORD_WEBHOOK_URL", "")
        embed = {
            "title": "🏛 社長メモ",
            "description": memo_body,
            "color": 0x2C3E50,
        }
        if not webhook_url:
            post_result = "未設定（.env.localにHITOMAP_DISCORD_WEBHOOK_URLを追加してください）"
        else:
            try:
                status = _send_discord_message(webhook_url, "**AI社長より**", embed)
                post_result = str(status)
            except Exception as e:
                post_result = f"投稿エラー: {e}"

        common.write_result("shacho_memo_daily", {
            "attention_count": cc.get("attention_count", 0),
            "top_agent_id": top["agent_id"] if top else None,
            "top_headline": top["headline"] if top else None,
            "memo": memo_body,
            "post_result": post_result,
        })


if __name__ == "__main__":
    main()
