"""競合プロダクト機能差分モニタAI（42/49・9F データ・分析R&D）— 名指しの競合プロダクトの
新機能・リリース・アップデート報道をGoogle News RSSで監視する。後追いされる前に気づくための装置。
competitor_market_research.py（市場全体の動向）とは別に、こちらは「名前の分かっている競合」を
個別にウォッチする。LLM APIは使わない。
自分ではDiscordに投稿しない——marketing_digest.pyが他のマーケティング系エージェントと
まとめて1日1回報告する。
"""
import calendar
import re
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import quote

import feedparser

import common

MAX_AGE_HOURS = 24 * 7  # Google News検索は日付順ではないため、when:7dで母集団を絞ってから直近分を拾う
PER_QUERY = 4
PER_COMPETITOR = 5

# 05_広報コンテンツ/調査で特定済みの直接比較対象・参考事例（reference_competitor_apps_20260714メモ準拠）。
# 増えたらここに追記するだけでよい。
COMPETITORS = {
    "TISI 地域幸福度可視化アプリ": ["TISI 地域幸福度", "TIS 幸福度可視化"],
    "ソーシャルヒートマップ（竹中工務店）": ["竹中工務店 ソーシャルヒートマップ"],
    "さのスマートセーフマップ（佐野市）": ["さのスマートセーフマップ"],
    "Place2B（DNP）": ["Place2B DNP 地域"],
    "MoodMap": ["MoodMap 感情マップ"],
}

UPDATE_KEYWORDS = ["新機能", "アップデート", "リリース", "刷新", "提供開始", "実証実験", "導入", "連携"]

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
                "is_update": any(kw in title for kw in UPDATE_KEYWORDS),
            })
    except Exception as e:
        items.append({"title": f"⚠️ 「{query}」取得失敗: {e}", "link": "", "source": "", "pub": "", "is_update": False})
    return items[:limit]


def main():
    with common.running("competitor_feature_monitor"):
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
        digest = {}
        for competitor, queries in COMPETITORS.items():
            items = []
            seen = set()
            for q in queries:
                for item in _fetch_query(q, cutoff, PER_QUERY):
                    if item["title"] in seen:
                        continue
                    seen.add(item["title"])
                    items.append(item)
            items.sort(key=lambda i: (not i["is_update"], i["pub"]), reverse=False)
            items.sort(key=lambda i: i["pub"], reverse=True)
            digest[competitor] = items[:PER_COMPETITOR]

        total = sum(len(v) for v in digest.values())
        update_count = sum(1 for items in digest.values() for i in items if i.get("is_update"))
        common.write_result("competitor_feature_monitor", {
            "total": total,
            "update_count": update_count,
            "categories": {k: len(v) for k, v in digest.items()},
            "digest": digest,
        })


if __name__ == "__main__":
    main()
