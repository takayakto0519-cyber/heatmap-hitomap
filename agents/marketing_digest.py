"""マーケティング日報AI — マーケティング系エージェント（競合・市場調査／投稿パターン分析／
関係人口／ニュース番人の観光・関係人口・採用DXカテゴリ）の結果を1つにまとめ、1日1回だけ
Discordへ報告する。個々のエージェントは無言でwork/*.jsonに結果を書くだけにして、
「まとめて1日1回」という運用ルールをこのエージェントだけが担う。
LLM APIは使わない（各エージェントの生データを固定フォーマットで整形するだけ）。
実行間隔は1日1回（register_tasks.ps1でタスクスケジューラに登録。他のマーケティング系
エージェントより後の時刻に設定すること）。
"""
import json
import urllib.request
from datetime import datetime

import common

# ここに並べたagent_idの結果だけを「マーケティング関連」として日報にまとめる。
# 新しいマーケティング系エージェントを追加したら、このリストにagent_idを足すだけでよい。
MARKETING_AGENTS = ["competitor_market_research", "competitor_feature_monitor", "trace_pattern", "relation_population"]

# news_digestは8時間ごとに自前でDiscord投稿しているため全文は転載しない。
# ただしマーケティング色の強い「観光・関係人口・採用DX」カテゴリだけは要点を拾う。
NEWS_DIGEST_CATEGORY = "観光・関係人口・採用DX"
NEWS_DIGEST_PICK = 5


def _send_discord_message(webhook_url: str, content: str, embeds: list[dict]) -> int:
    payload = {"username": "ヒトマップ マーケティング番人", "content": content, "embeds": embeds}
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "HitomapMarketingDigest/1.0 (+https://github.com/hitomap)",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return res.status


def _embed_competitor_market_research(data: dict) -> dict | None:
    if not data or data.get("error"):
        return None
    digest = data.get("digest") or {}
    lines = []
    for category, items in digest.items():
        if not items:
            continue
        lines.append(f"**{category}**")
        for i in items[:4]:
            head = f"・[{i['title']}]({i['link']})" if i.get("link") else f"・{i['title']}"
            if i.get("source"):
                head += f" -# {i['source']}"
            lines.append(head)
    if not lines:
        return None
    return {
        "title": f"🔍 競合・市場調査（{data.get('total', 0)}件）",
        "description": "\n".join(lines)[:4000],
        "color": 0x8E44AD,
    }


def _embed_competitor_feature_monitor(data: dict) -> dict | None:
    if not data or data.get("error"):
        return None
    digest = data.get("digest") or {}
    lines = []
    for competitor, items in digest.items():
        if not items:
            continue
        lines.append(f"**{competitor}**")
        for i in items[:3]:
            mark = "🆕 " if i.get("is_update") else ""
            head = f"・{mark}[{i['title']}]({i['link']})" if i.get("link") else f"・{mark}{i['title']}"
            lines.append(head)
    if not lines:
        return None
    return {
        "title": f"🦎 競合プロダクト機能差分モニタ（{data.get('total', 0)}件・更新らしき報道{data.get('update_count', 0)}件）",
        "description": "\n".join(lines)[:4000],
        "color": 0x2E86AB,
    }


def _embed_trace_pattern(data: dict) -> dict | None:
    if not data or data.get("error") or not data.get("total"):
        return None
    lines = [
        f"総投稿数：{data['total']}件",
        f"また来たい率：{data.get('want_revisit_rate', '—')}%",
        f"話したい率：{data.get('want_to_share_rate', '—')}%",
        f"書き込みの厚み（3問完答率）：{data.get('deep_write_rate', '—')}%",
    ]
    if data.get("peak_hours"):
        lines.append(f"投稿の多い時間帯：{'、'.join(data['peak_hours'])}")
    return {"title": "📊 投稿パターン分析", "description": "\n".join(lines), "color": 0xCAA24A}


def _embed_relation_population(data: dict) -> dict | None:
    if not data or data.get("error") or not data.get("total_contributors"):
        return None
    lines = [
        f"関わった人数：{data['total_contributors']}人",
        f"複数回関わった人（関係人口の芽）：{data['repeat_contributors']}人（{data.get('repeat_rate', '—')}%）",
        f"また来たいと答えた人：{data.get('want_revisit_people', '—')}人",
    ]
    return {"title": "🔁 関係人口", "description": "\n".join(lines), "color": 0x3D7A5C}


def _embed_news_pick(news_digest_data: dict | None) -> dict | None:
    if not news_digest_data:
        return None
    items = (news_digest_data.get("digest") or {}).get(NEWS_DIGEST_CATEGORY) or []
    if not items:
        return None
    lines = []
    for i in items[:NEWS_DIGEST_PICK]:
        head = f"・[{i['title']}]({i['link']})" if i.get("link") else f"・{i['title']}"
        lines.append(head)
    return {"title": f"📰 {NEWS_DIGEST_CATEGORY}（ニュース番人より）", "description": "\n".join(lines)[:4000], "color": 0xCAA24A}


def main():
    with common.running("marketing_digest"):
        results = {agent_id: common.read_result(agent_id) for agent_id in MARKETING_AGENTS}
        news_digest_data = common.read_result("news_digest")

        embeds = []
        cmr = _embed_competitor_market_research(results.get("competitor_market_research"))
        if cmr:
            embeds.append(cmr)
        cfm = _embed_competitor_feature_monitor(results.get("competitor_feature_monitor"))
        if cfm:
            embeds.append(cfm)
        tp = _embed_trace_pattern(results.get("trace_pattern"))
        if tp:
            embeds.append(tp)
        rp = _embed_relation_population(results.get("relation_population"))
        if rp:
            embeds.append(rp)
        news_pick = _embed_news_pick(news_digest_data)
        if news_pick:
            embeds.append(news_pick)

        env = common.load_env_local()
        webhook_url = env.get("DISCORD_WEBHOOK_URL", "")
        if not webhook_url:
            post_result = "未設定（.env.localにDISCORD_WEBHOOK_URLを追加してください）"
        elif not embeds:
            post_result = "報告できる新しい調査結果なし（投稿スキップ）"
        else:
            title = f"**{datetime.now().strftime('%Y-%m-%d')} マーケティング日報**（{len(embeds)}分野）"
            try:
                status = _send_discord_message(webhook_url, title, embeds)
                post_result = str(status)
            except Exception as e:
                post_result = f"投稿エラー: {e}"

        common.write_result("marketing_digest", {
            "sections": len(embeds),
            "post_result": post_result,
        })


if __name__ == "__main__":
    main()
