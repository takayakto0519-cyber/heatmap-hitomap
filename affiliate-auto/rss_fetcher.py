"""
RSSフェッチャー + トレンドスコアリング
複数ソースからフィードを取得し、ターゲットカテゴリに近いアイテムをスコアリング
"""
import json
import time
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict

import feedparser
import requests

from config import RSS_FEEDS, TARGET_KEYWORDS, CACHE_DIR, LOGS_DIR


def fetch_all_feeds(max_age_hours: int = 24) -> List[Dict]:
    """全RSSフィードを取得し、過去24時間以内の記事に絞る"""
    cache_path = CACHE_DIR / "rss_cache.json"
    cutoff = datetime.now() - timedelta(hours=max_age_hours)
    items = []

    for url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                # 日付パース
                pub = None
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    pub = datetime(*entry.published_parsed[:6])
                elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                    pub = datetime(*entry.updated_parsed[:6])
                else:
                    pub = datetime.now()

                if pub < cutoff:
                    continue

                title   = getattr(entry, "title", "")
                summary = getattr(entry, "summary", "")
                link    = getattr(entry, "link", "")

                items.append({
                    "title":   title,
                    "summary": summary[:300],
                    "link":    link,
                    "pub":     pub.isoformat(),
                    "source":  url,
                    "text":    f"{title} {summary}",
                })

            time.sleep(0.5)

        except Exception as e:
            print(f"[rss] フェッチ失敗 {url}: {e}")

    # キャッシュ保存
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"[rss] 取得記事数: {len(items)}")
    return items


def score_items(items: List[Dict]) -> List[Dict]:
    """
    各記事にターゲットキーワードとの関連スコアを付与
    スコア = マッチしたターゲットキーワード数 × 新しさ補正
    """
    now = datetime.now()
    scored = []

    for item in items:
        text_lower = item["text"].lower()
        match_kws  = []

        for kw in TARGET_KEYWORDS:
            if kw in item["text"]:
                match_kws.append(kw)

        if not match_kws:
            continue

        # 新しさ補正（12時間以内は2倍）
        try:
            pub = datetime.fromisoformat(item["pub"])
            age_hours = (now - pub).total_seconds() / 3600
            recency_bonus = 2.0 if age_hours < 12 else 1.0
        except Exception:
            recency_bonus = 1.0

        item["score"]      = len(match_kws) * recency_bonus
        item["match_kws"]  = match_kws
        scored.append(item)

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def extract_trending_keywords(scored_items: List[Dict], top_n: int = 5) -> List[Dict]:
    """
    スコア上位記事から「今日狙うべきキーワード候補」を抽出
    """
    kw_counter: Dict[str, int] = {}
    kw_articles: Dict[str, List[str]] = {}

    for item in scored_items[:50]:  # 上位50記事のみ分析
        for kw in item.get("match_kws", []):
            kw_counter[kw] = kw_counter.get(kw, 0) + 1
            kw_articles.setdefault(kw, [])
            kw_articles[kw].append(item["title"][:40])

    # カウント順にソート
    sorted_kws = sorted(kw_counter.items(), key=lambda x: x[1], reverse=True)

    results = []
    for kw, count in sorted_kws[:top_n]:
        # 検索クエリ候補を生成
        search_variants = _generate_search_queries(kw, kw_articles.get(kw, []))
        results.append({
            "keyword":        kw,
            "count":          count,
            "search_queries": search_variants,
            "sample_titles":  kw_articles.get(kw, [])[:3],
        })

    print(f"[rss] トレンドKW: {[r['keyword'] for r in results]}")
    return results


def _generate_search_queries(kw: str, related_titles: List[str]) -> List[str]:
    """キーワードから検索クエリ候補を生成"""
    suffixes = ["比較", "おすすめ", "選び方", "疲れない", "安定性", "寿命", "コスパ"]
    scenes   = ["ワーケーション", "出張", "リモートワーク", "新幹線", "カフェ"]

    queries = [f"{kw} 比較 おすすめ"]
    for sfx in suffixes[:3]:
        queries.append(f"{kw} {sfx}")
    for scene in scenes[:2]:
        queries.append(f"{scene} {kw}")

    return queries[:5]


def run() -> List[Dict]:
    """メイン実行: フェッチ → スコアリング → KW抽出"""
    items   = fetch_all_feeds()
    scored  = score_items(items)
    kws     = extract_trending_keywords(scored)

    # ログ保存
    log_path = LOGS_DIR / f"rss_{datetime.now().strftime('%Y%m%d')}.json"
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump({"items_count": len(items), "scored": len(scored), "keywords": kws}, f, ensure_ascii=False, indent=2)

    return kws
