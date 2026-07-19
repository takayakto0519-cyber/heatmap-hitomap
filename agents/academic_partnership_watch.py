"""産学連携リサーチAI（52・10F 新規事業探索）— 大学との連携公募・共同研究・地域連携の
動きをGoogle News RSSでルールベース収集する。卒論（人間観光と地域愛着）を通じて
東京農業大学とのつながりがあるため、大学名を優先的にウォッチする。LLM APIは使わない。
自分ではDiscordに投稿しない——結果はwork/academic_partnership_watch.jsonに書くだけ。
"""
import calendar
import re
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import quote

import feedparser

import common

MAX_AGE_HOURS = 24 * 7
PER_QUERY = 4
PER_CATEGORY = 6

QUERIES = {
    "東京農業大学の連携動向": [
        "東京農業大学 産学連携",
        "東京農業大学 地域連携",
    ],
    "大学×地域連携の公募・事例": [
        "大学 地域 連携 公募",
        "産学連携 観光 地域活性化",
    ],
    "大学発スタートアップ・研究連携支援": [
        "大学発ベンチャー 支援制度",
    ],
}

STRIP_TAGS_RE = re.compile(r"<[^<]+?>")


def _clean_title(raw: str, max_len: int = 90) -> str:
    text = unescape(STRIP_TAGS_RE.sub("", raw or "")).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:max_len] + ("…" if len(text) > max_len else "")


def _to_utc_datetime(struct_time) -> datetime:
    return datetime.fromtimestamp(calendar.timegm(struct_time), tz=timezone.utc)


def _google_news_rss_url(query: str) -> str:
    return f"https://news.google.com/rss/search?q={quote(query + ' when:7d')}&hl=ja&gl=JP&ceid=JP:ja"


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
        items.append({"title": f"⚠️ 「{query}」取得失敗: {e}", "link": "", "source": "", "pub": ""})
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
    with common.running("academic_partnership_watch"):
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
        digest = {category: _fetch_category(queries, cutoff, PER_CATEGORY) for category, queries in QUERIES.items()}
        total = sum(len(v) for v in digest.values())
        common.write_result("academic_partnership_watch", {
            "total": total,
            "categories": {k: len(v) for k, v in digest.items()},
            "digest": digest,
        })


if __name__ == "__main__":
    main()
