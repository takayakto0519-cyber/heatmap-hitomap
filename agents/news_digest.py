"""今日のニュース抽出AI — RSS/市場ニュースページから幅広い分野のニュースを集めてDiscordへ投稿する。
LLM APIは使わず、RSS取得・HTMLスクレイピング・ルールベースの絞り込みのみで完結させる（要約もAI生成せず見出し＋リンクをそのまま使う）。
実行間隔は8時間ごと（register_tasks.ps1でタスクスケジューラに登録）。
"""
import calendar
import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from html import unescape

import feedparser

import common

MAX_AGE_HOURS = 8  # 8時間ごとの実行なので取得範囲もそれに合わせる
PER_CATEGORY = 6
STOCK_PER_CATEGORY = 12  # 個別銘柄ニュースはできるだけ多く載せる

BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

FEEDS = {
    "総合ニュース": [
        ("NHKニュース", "https://www.nhk.or.jp/rss/news/cat0.xml"),
        ("Yahoo!ニュース主要", "https://news.yahoo.co.jp/rss/topics/top-picks.xml"),
    ],
    "国際": [
        ("Yahoo!ニュース国際", "https://news.yahoo.co.jp/rss/topics/world.xml"),
    ],
    "ビジネス・経済": [
        ("Yahoo!ニュース経済", "https://news.yahoo.co.jp/rss/topics/business.xml"),
        ("東洋経済オンライン", "https://toyokeizai.net/list/feed/rss"),
    ],
    "テック・ガジェット": [
        ("ITmedia速報", "https://www.itmedia.co.jp/rss/2.0/news/bursts/rss.xml"),
        ("Engadget日本版", "https://japanese.engadget.com/rss.xml"),
        ("Yahoo!ニュースIT", "https://news.yahoo.co.jp/rss/topics/it.xml"),
    ],
    "科学": [
        ("Yahoo!ニュース科学", "https://news.yahoo.co.jp/rss/topics/science.xml"),
    ],
    "スポーツ": [
        ("Yahoo!ニューススポーツ", "https://news.yahoo.co.jp/rss/topics/sports.xml"),
    ],
    "エンタメ": [
        ("Yahoo!ニュースエンタメ", "https://news.yahoo.co.jp/rss/topics/entertainment.xml"),
    ],
    "観光・関係人口・採用DX": [
        ("Yahoo!ニュース地方", "https://news.yahoo.co.jp/rss/topics/local.xml"),
        ("PR TIMES 地域・行政", "https://prtimes.jp/index.rdf"),
    ],
}

# 観光・関係人口・採用DXカテゴリは、関係のない地方ニュース（事件・事故等）が混ざりやすいためキーワードで絞り込む
TOURISM_KEYWORDS = [
    "観光", "移住", "関係人口", "ふるさと", "インターン", "採用", "地方創生",
    "ワーケーション", "地域活性化", "自治体", "訪日", "インバウンド",
]


STRIP_TAGS_RE = re.compile(r"<[^<]+?>")


def _clean_summary(raw: str, max_len: int = 70) -> str:
    text = unescape(STRIP_TAGS_RE.sub("", raw or "")).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:max_len] + ("…" if len(text) > max_len else "")


def _to_utc_datetime(struct_time) -> datetime:
    # feedparserのpublished_parsed/updated_parsedは常にUTCのstruct_time
    return datetime.fromtimestamp(calendar.timegm(struct_time), tz=timezone.utc)


def _fetch_category(feeds: list[tuple[str, str]], keyword_filter: list[str] | None = None,
                     limit: int = PER_CATEGORY) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
    items = []
    for source_name, url in feeds:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                pub = None
                if getattr(entry, "published_parsed", None):
                    pub = _to_utc_datetime(entry.published_parsed)
                elif getattr(entry, "updated_parsed", None):
                    pub = _to_utc_datetime(entry.updated_parsed)
                else:
                    pub = datetime.now(timezone.utc)
                if pub < cutoff:
                    continue
                title = getattr(entry, "title", "")
                if keyword_filter and not any(kw in title for kw in keyword_filter):
                    continue
                summary_raw = getattr(entry, "summary", "") or getattr(entry, "description", "")
                items.append({
                    "title": title,
                    "link": getattr(entry, "link", ""),
                    "source": source_name,
                    "summary": _clean_summary(summary_raw),
                    "pub": pub.isoformat(),
                })
        except Exception as e:
            items.append({"title": f"⚠️ {source_name}取得失敗: {e}", "link": "", "source": source_name, "pub": ""})
    items.sort(key=lambda i: i["pub"], reverse=True)
    return items[:limit]


# 株探（kabutan.jp）市場ニュース一覧をスクレイピング。個別銘柄・決算・材料ニュースが多く、
# 一般のニュースRSSより「株の個別銘柄ニュース」の密度が高いため専用に用意する。
KABUTAN_URL = "https://kabutan.jp/news/marketnews/?rss=1"
KABUTAN_LINK_RE = re.compile(
    r'<a href="(/news/marketnews/\?&b=n(\d{8})\d*)"[^>]*>([^<]{4,120})'
)


def _fetch_stock_news(limit: int = STOCK_PER_CATEGORY) -> list[dict]:
    today = datetime.now().strftime("%Y%m%d")
    items = []
    try:
        req = urllib.request.Request(KABUTAN_URL, headers={"User-Agent": BROWSER_UA})
        with urllib.request.urlopen(req, timeout=10) as res:
            html = res.read().decode("utf-8", errors="ignore")
        seen_links = set()
        for href, date_str, title in KABUTAN_LINK_RE.findall(html):
            if date_str != today:
                continue
            if href in seen_links:
                continue
            seen_links.add(href)
            items.append({
                "title": unescape(title).strip(),
                "link": "https://kabutan.jp" + href,
                "source": "株探（kabutan）",
                "pub": date_str,
            })
    except Exception as e:
        items.append({"title": f"⚠️ 株探取得失敗: {e}", "link": "", "source": "株探（kabutan）", "pub": ""})
    return items[:limit]


DISCORD_MSG_BUDGET = 5500  # Discordの1メッセージあたりembed合計6000文字制限に対する安全マージン


def _build_category_embed(category: str, items: list[dict], color: int) -> dict:
    lines = []
    for i in items:
        head = f"**[{i['title']}]({i['link']})**" if i["link"] else f"**{i['title']}**"
        meta_bits = [b for b in (i.get("source"), i.get("pub", "")[:16].replace("T", " ")) if b]
        if meta_bits:
            head += f"\n-# {' ｜ '.join(meta_bits)}"
        if i.get("summary"):
            head += f"\n> {i['summary']}"
        lines.append(head)
    return {
        "title": f"📰 {category}（{len(items)}件）",
        "description": "\n\n".join(lines)[:4000],
        "color": color,
    }


def _send_discord_message(webhook_url: str, content: str, embeds: list[dict]) -> int:
    payload = {"username": "ヒトマップ ニュース番人", "content": content, "embeds": embeds}
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            # DiscordのCloudflareがurllibの既定UAを弾くため明示的に指定する
            "User-Agent": "HitomapNewsDigest/1.0 (+https://github.com/hitomap)",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return res.status


def _post_to_discord(webhook_url: str, digest: dict) -> str:
    colors = {
        "総合ニュース": 0x5B6B85, "国際": 0x7A5C9E, "ビジネス・経済": 0x3D7A5C,
        "株式・個別銘柄": 0xC0392B, "テック・ガジェット": 0xFF9A3D, "科学": 0x2E86AB,
        "スポーツ": 0x27AE60, "エンタメ": 0xE84393, "観光・関係人口・採用DX": 0xCAA24A,
    }
    all_embeds = [
        _build_category_embed(category, items, colors.get(category, 0x8A8171))
        for category, items in digest.items() if items
    ]

    # 1メッセージの合計文字数が上限を超えないよう、埋まったところで新しいメッセージに分割する
    batches: list[list[dict]] = []
    current: list[dict] = []
    current_len = 0
    for embed in all_embeds:
        embed_len = len(embed["title"]) + len(embed["description"])
        if current and (len(current) >= 10 or current_len + embed_len > DISCORD_MSG_BUDGET):
            batches.append(current)
            current, current_len = [], 0
        current.append(embed)
        current_len += embed_len
    if current:
        batches.append(current)

    title = f"**{datetime.now().strftime('%Y-%m-%d %H:%M')} ニュースダイジェスト**"
    statuses = []
    for idx, batch in enumerate(batches):
        content = title if idx == 0 else f"（続き {idx + 1}/{len(batches)}）"
        try:
            statuses.append(str(_send_discord_message(webhook_url, content, batch)))
        except Exception as e:
            statuses.append(f"エラー({e})")
    return f"{len(batches)}通に分割投稿 → " + ", ".join(statuses)


def main():
    with common.running("news_digest"):
        digest = {
            category: _fetch_category(feeds, TOURISM_KEYWORDS if category == "観光・関係人口・採用DX" else None)
            for category, feeds in FEEDS.items()
        }
        digest["株式・個別銘柄"] = _fetch_stock_news()
        total = sum(len(v) for v in digest.values())

        env = common.load_env_local()
        webhook_url = env.get("DISCORD_WEBHOOK_URL", "")
        post_result = "未実行"
        if not webhook_url:
            post_result = "未設定（.env.localにDISCORD_WEBHOOK_URLを追加してください）"
        elif total == 0:
            post_result = "直近分の記事なし（投稿スキップ）"
        else:
            try:
                post_result = _post_to_discord(webhook_url, digest)
            except Exception as e:
                post_result = f"投稿エラー: {e}"

        common.write_result("news_digest", {
            "total": total,
            "categories": {k: len(v) for k, v in digest.items()},
            "digest": digest,
            "post_result": post_result,
        })


if __name__ == "__main__":
    main()
