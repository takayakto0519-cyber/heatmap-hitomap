"""AI社長「週次・経営会議メモ」— command_center（7部門の要注意・正常件数）と
financial_snapshot（事業別の運用状況）・case_pipeline_watch（案件パイプライン）を
1枚に統合し、週1回（毎週月曜）Discordへ経営会議メモとして投げる。
個々の番人は無言でwork/*.jsonに書くだけにして、「週1回・1枚にまとめる」という
運用ルールをこのエージェントだけが担う（marketing_digest.pyと同じ設計思想）。
LLM APIは使わず、ローカルのwork/*.json読み取りのみ。
"""
import json
import urllib.request

import common

FLOOR_ORDER = ["GA", "SALES", "PR", "PRODUCT", "CLIENT", "FINANCE"]


def _department_line(floor: dict) -> str:
    name = floor["floor_name"]
    ok = floor.get("ok_count", 0)
    attention = floor.get("attention", [])
    if not attention:
        return f"**{name}**：平常運転（{ok}件正常）"
    heads = "／".join(a["headline"] for a in attention[:3])
    return f"**{name}**：要注意{len(attention)}件 — {heads}"


def _pipeline_line(case_pipeline: dict | None) -> str | None:
    if not case_pipeline or case_pipeline.get("error"):
        return None
    total = case_pipeline.get("total", 0)
    stale = case_pipeline.get("stale_count", 0)
    if not total:
        return None
    line = f"案件パイプライン：{total}件"
    if stale:
        line += f"（うち停滞{stale}件）"
    return line


def _financial_line(fin: dict | None) -> str | None:
    if not fin or fin.get("error"):
        return None
    product = fin.get("product", {})
    if not product or product.get("error"):
        return None
    return f"直近7日の新規投稿：{product.get('new_this_week', 0)}件（総投稿数{product.get('total_traces', 0)}件）"


def _compose_memo(floors: list[dict], case_pipeline: dict | None, fin: dict | None) -> str:
    by_id = {f["floor_id"]: f for f in floors}
    dept_lines = [_department_line(by_id[fid]) for fid in FLOOR_ORDER if fid in by_id]

    money_lines = [l for l in (_pipeline_line(case_pipeline), _financial_line(fin)) if l]

    total_attention = sum(len(f.get("attention", [])) for f in floors)
    opening = (
        "今週も止まっていない。それがまず結果だ。" if total_attention <= 2
        else f"要注意が{total_attention}件、部門をまたいで溜まっている。1つずつ潰す週にする。"
    )

    parts = [opening, "", "**部門別**"] + dept_lines
    if money_lines:
        parts += ["", "**数字**"] + money_lines
    parts += ["", "来週、同じ部門で同じ要注意を出さないためには何を変えるか。"]
    return "\n".join(parts)


def _send_discord_message(webhook_url: str, content: str, embed: dict) -> int:
    payload = {"username": "AI社長", "content": content, "embeds": [embed]}
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "HitomapShachoKeieikaigiWeekly/1.0 (+https://github.com/hitomap)",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return res.status


def main():
    with common.running("shacho_keiei_kaigi_weekly"):
        cc = common.read_result("command_center")
        if cc is None:
            common.write_result("shacho_keiei_kaigi_weekly", {"error": "command_centerの結果がありません（先にcommand_center.pyを実行）"})
            return

        floors = cc.get("floors", [])
        case_pipeline = common.read_result("case_pipeline_watch")
        fin = common.read_result("financial_snapshot")
        memo_body = _compose_memo(floors, case_pipeline, fin)

        env = common.load_env_local()
        webhook_url = env.get("HITOMAP_DISCORD_WEBHOOK_URL") or env.get("DISCORD_WEBHOOK_URL", "")
        embed = {
            "title": "🏛 経営会議メモ（週次）",
            "description": memo_body[:4000],
            "color": 0x2C3E50,
        }
        if not webhook_url:
            post_result = "未設定（.env.localにHITOMAP_DISCORD_WEBHOOK_URLを追加してください）"
        else:
            try:
                status = _send_discord_message(webhook_url, "**AI社長より・今週の経営会議**", embed)
                post_result = str(status)
            except Exception as e:
                post_result = f"投稿エラー: {e}"

        common.write_result("shacho_keiei_kaigi_weekly", {
            "total_attention": sum(len(f.get("attention", [])) for f in floors),
            "memo": memo_body,
            "post_result": post_result,
        })


if __name__ == "__main__":
    main()
