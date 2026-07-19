"""競合・市場調査AI（マーケティング番人）— 類似サービスの動き・自治体DX支援の市場・
AI導入コンサル市場のニュースをGoogle News RSS経由でルールベース収集する。
LLM APIは使わずRSS取得＋キーワード絞り込みのみで完結させる（要約もAI生成せず見出し＋リンクをそのまま使う）。
自分ではDiscordに投稿しない——結果は work/competitor_market_research.json に書き出し、
marketing_digest.py が他のマーケティング系エージェントの結果とまとめて1日1回報告する。
実行間隔は1日1回（register_tasks.ps1でタスクスケジューラに登録）。
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
PER_CATEGORY = 6

# カテゴリごとに複数の検索クエリを持つ。Google News RSSの検索フィードはAPIキー不要で使える。
QUERIES = {
    "競合サービスの動き": [
        "関係人口 プラットフォーム",
        "地域 観光DX サービス",
        "ホスト マッチング 観光体験",
    ],
    "自治体スタートアップ支援・市場動向": [
        "自治体 スタートアップ支援 公募",
        "ビジネスプランコンテスト 自治体",
        "地方創生 起業 補助金",
    ],
    "AI導入・コンサル市場": [
        "生成AI 導入支援 中小企業",
        "AI コンサル 補助金 自治体",
    ],
    "採用DX・インターン市場": [
        "採用DX インターンシップ 企業",
        "トレーディングカード 採用 企業",
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
    # Google Newsの検索RSSは関連度順で日付順ではないため、when:7dを付けて直近7日に母集団を絞る
    # （絞らないと数ヶ月前の記事が上位に来て、直近ニュースが取得漏れする）
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
            # Google Newsのtitleは「見出し - 媒体名」の形式なので媒体名を分離する
            raw_title = getattr(entry, "title", "")
            source = getattr(getattr(entry, "source", None), "title", None)
            title = raw_title
            if source and raw_title.endswith(f" - {source}"):
                title = raw_title[: -(len(source) + 3)]
            items.append({
                "title": _clean_title(title),
                "link": getattr(entry, "link", ""),
                "source": source or "Google News",
                "query": query,
                "pub": pub.isoformat(),
            })
    except Exception as e:
        items.append({"title": f"⚠️ 「{query}」取得失敗: {e}", "link": "", "source": "", "query": query, "pub": ""})
    return items[:limit]


def _fetch_category(queries: list[str], cutoff: datetime, limit: int) -> list[dict]:
    items = []
    seen_titles = set()
    for q in queries:
        for item in _fetch_query(q, cutoff, PER_QUERY):
            if item["title"] in seen_titles:
                continue
            seen_titles.add(item["title"])
            items.append(item)
    items.sort(key=lambda i: i["pub"], reverse=True)
    return items[:limit]


def main():
    with common.running("competitor_market_research"):
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
        digest = {category: _fetch_category(queries, cutoff, PER_CATEGORY) for category, queries in QUERIES.items()}
        total = sum(len(v) for v in digest.values())
        common.write_result("competitor_market_research", {
            "total": total,
            "categories": {k: len(v) for k, v in digest.items()},
            "digest": digest,
        })


if __name__ == "__main__":
    main()
