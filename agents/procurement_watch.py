"""公募・実証実験監視AI（営業番人）— 自治体はコールドメールでなく公募・実証実験募集・
プロポーザル・少額随意契約が受注の主戦場、というディープリサーチの結論を受けて新設。
Google News RSS（when:7d必須、日付順ではなく関連度順の罠に注意）で締切付きの公募情報を集める。
LLM APIは使わずRSS取得＋キーワード絞り込みのみ。自分では通知せず、
work/procurement_watch.json に書き出し、command_center・営業コックピットが表示する。
実行間隔は1日1回（register_tasks.ps1でタスクスケジューラに登録）。
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
PER_CATEGORY = 8

# 一般クエリ（関係人口・観光DX・移住定住まわりの公募全般）＋ 現在パイプラインにある自治体名を
# 個別クエリとして追加する（少額随契の入口は「相手を知っている」ことが有利に働くため）。
QUERIES = {
    "関係人口・移住定住の公募": [
        "関係人口 プロポーザル 委託",
        "移住定住 業務委託 公募",
        "関係人口創出 実証実験 募集",
    ],
    "観光DX・地域振興の公募": [
        "観光DX プロポーザル 自治体",
        "デジタル田園都市 交付金 公募",
        "地域振興 業務委託 プロポーザル",
    ],
    "パイプライン自治体の動き": [
        "佐野市 デジタル 公募",
        "牧之原市 デジタル化 公募",
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
    with common.running("procurement_watch"):
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
        digest = {category: _fetch_category(queries, cutoff, PER_CATEGORY) for category, queries in QUERIES.items()}
        total = sum(len(v) for v in digest.values())
        common.write_result("procurement_watch", {
            "total": total,
            "categories": {k: len(v) for k, v in digest.items()},
            "digest": digest,
            "note": "見出し・リンクのみ機械的に収集（要約はしない）。実際の公募要件・締切は必ずリンク先を確認してください。",
        })


if __name__ == "__main__":
    main()
