"""海外展開リサーチAI（51・10F 新規事業探索）— 英語圏の関係人口・観光DX・地域再生の
市場動向をGoogle News RSS（英語）でルールベース収集する。LLM APIは使わない。
自分ではDiscordに投稿しない——結果はwork/global_market_watch.jsonに書くだけ。
"""
import calendar
import re
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import quote

import feedparser

import common

MAX_AGE_HOURS = 24 * 14  # 英語圏ニュースは母数が少ないため2週間分を対象にする
PER_QUERY = 4
PER_CATEGORY = 6

QUERIES = {
    "海外の関係人口・観光DX動向": [
        "\"relationship population\" tourism Japan",
        "regional revitalization tourism startup",
    ],
    "海外のホストマッチング・体験観光サービス": [
        "experience-based tourism platform startup",
        "community tourism app funding",
    ],
    "海外のAIコンサル・自治体DX市場": [
        "AI consulting local government startup",
    ],
}

STRIP_TAGS_RE = re.compile(r"<[^<]+?>")


def _clean_title(raw: str, max_len: int = 100) -> str:
    text = unescape(STRIP_TAGS_RE.sub("", raw or "")).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:max_len] + ("…" if len(text) > max_len else "")


def _to_utc_datetime(struct_time) -> datetime:
    return datetime.fromtimestamp(calendar.timegm(struct_time), tz=timezone.utc)


def _google_news_rss_url(query: str) -> str:
    return f"https://news.google.com/rss/search?q={quote(query + ' when:14d')}&hl=en-US&gl=US&ceid=US:en"


def _fetch_query(query: str, cutoff: datetime, limit: int) -> list[dict]:
    items = []
    try:
        feed = feedparser.parse(_google_news_rss_url(query))
        for entry in feed.entries:
            pub = None
            if getattr(entry, "published_parsed", None):
                pub = _to_utc_datetime(entry.published_parsed)
            if pub is None or pub < cutoff:
                continue
            raw_title = getattr(entry, "title", "")
            source = getattr(getattr(entry, "source", None), "title", None)
            title = raw_title
            if source and raw_title.endswith(f" - {source}"):
                title = raw_title[: -(len(source) + 3)]
            items.append({
                "title": _clean_title(title),
                "link": getattr(entry, "link", ""),
                "source": source or "Google News",
                "pub": pub.isoformat(),
            })
    except Exception as e:
        items.append({"title": f"⚠️ query failed: {query} ({e})", "link": "", "source": "", "pub": ""})
    return items[:limit]


def _fetch_category(queries: list[str], cutoff: datetime, limit: int) -> list[dict]:
    items, seen = [], set()
    for q in queries:
        for item in _fetch_query(q, cutoff, PER_QUERY):
            if item["title"] in seen:
                continue
            seen.add(item["title"])
            items.append(item)
    items.sort(key=lambda i: i["pub"], reverse=True)
    return items[:limit]


def main():
    with common.running("global_market_watch"):
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
        digest = {category: _fetch_category(queries, cutoff, PER_CATEGORY) for category, queries in QUERIES.items()}
        total = sum(len(v) for v in digest.values())
        common.write_result("global_market_watch", {
            "total": total,
            "categories": {k: len(v) for k, v in digest.items()},
            "digest": digest,
        })


if __name__ == "__main__":
    main()
