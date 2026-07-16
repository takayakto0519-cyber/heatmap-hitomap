"""
MLキーワードセレクター — TF-IDF + janome
RSSトレンドデータから「今日書くべき最適キーワード」を1つ決定する
"""
import json
import re
from datetime import date
from typing import List, Dict, Optional

from config import LOGS_DIR, CACHE_DIR, TARGET_KEYWORDS, TFIDF_MAX_FEATURES


def tokenize_japanese(text: str) -> List[str]:
    """janome で形態素解析。インストール不要時は簡易分割にフォールバック"""
    try:
        from janome.tokenizer import Tokenizer
        t = Tokenizer()
        tokens = []
        for token in t.tokenize(text):
            part = token.part_of_speech.split(",")[0]
            if part in ("名詞", "形容詞") and len(token.surface) > 1:
                tokens.append(token.surface)
        return tokens
    except ImportError:
        # フォールバック: カタカナ・漢字・ひらがな単語を正規表現で抽出
        return re.findall(r'[ァ-ヶー]{2,}|[一-龯々]{2,}|[ぁ-ん]{3,}', text)


def tfidf_score(keyword: str, corpus: List[str]) -> float:
    """指定キーワードのTF-IDFスコアを計算（軽量版）"""
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        vec = TfidfVectorizer(max_features=TFIDF_MAX_FEATURES, tokenizer=lambda t: [t], lowercase=False)
        tokenized = [" ".join(tokenize_japanese(doc)) for doc in corpus]
        tfidf = vec.fit_transform(tokenized)
        vocab = vec.get_feature_names_out()
        if keyword not in vocab:
            return 0.0
        idx = list(vocab).index(keyword)
        return float(tfidf[:, idx].mean())
    except Exception:
        # sklearn未インストール時: 単純頻度
        total = sum(doc.count(keyword) for doc in corpus)
        return total / max(len(corpus), 1)


def select_best_keyword(
    trending_kws: List[Dict],
    rss_items: Optional[List[Dict]] = None,
) -> Dict:
    """
    トレンドKWリストとRSS記事から最適キーワード+検索クエリを決定

    判定基準:
    1. RSSでの出現頻度（多いほど需要高）
    2. TARGET_KEYWORDS との合致（ターゲット読者の関心）
    3. 前回投稿との重複回避（ログ参照）
    """
    # 過去投稿KWを除外
    used_kws = _load_used_keywords()

    # スコアリング
    corpus = []
    if rss_items:
        corpus = [item.get("text", "") for item in rss_items[:100]]

    scored = []
    for kw_data in trending_kws:
        kw = kw_data["keyword"]
        if kw in used_kws:
            continue

        base_score  = kw_data.get("count", 1)
        tfidf_bonus = tfidf_score(kw, corpus) * 10 if corpus else 0
        final_score = base_score + tfidf_bonus

        scored.append({**kw_data, "final_score": final_score})

    if not scored:
        # 全KW使用済みの場合は最初のKWに戻る
        scored = [{**kw, "final_score": kw.get("count", 1)} for kw in trending_kws]

    scored.sort(key=lambda x: x["final_score"], reverse=True)
    best = scored[0]

    # 最適な検索クエリを選択
    # 単語が短い/汎用的な場合はアフィリエイト向け複合クエリを使う
    kw = best["keyword"]
    queries = best.get("search_queries", [])
    if not queries:
        queries = _generate_search_queries(kw, [])

    # 単語1語かつ英数字のみ（Wi-Fi, PC等）→ より具体的なクエリを優先
    is_generic = len(kw.replace("-", "").replace(" ", "")) <= 6 or re.match(r"^[A-Za-z0-9\-]+$", kw)
    if is_generic:
        # ワーケーション文脈の複合クエリを先頭に
        specific = [f"ワーケーション {kw} おすすめ", f"{kw} ルーター 比較 レビュー", f"{kw} 選び方 初心者"]
        queries = specific + queries

    best["selected_query"] = queries[0]

    # ログ記録
    _save_used_keyword(best["keyword"])
    print(f"[selector] 今日のKW: {best['keyword']} (score={best['final_score']:.2f})")
    return best


def prepare_all_keywords(
    trending_kws: List[Dict],
    rss_items: Optional[List[Dict]] = None,
) -> List[Dict]:
    """
    トレンドKW全件に検索クエリを付与して返す（最大5件）
    used_keywords チェックは行わない（全件処理のため）
    """
    corpus = [item.get("text", "") for item in (rss_items or [])[:100]]

    result = []
    for kw_data in trending_kws[:5]:
        kw = kw_data["keyword"]
        queries = kw_data.get("search_queries", [])
        if not queries:
            queries = _generate_search_queries(kw, [])

        # 汎用単語には具体クエリを優先
        is_generic = len(kw.replace("-", "").replace(" ", "")) <= 6 or re.match(r"^[A-Za-z0-9\-]+$", kw)
        if is_generic:
            specific = [f"ワーケーション {kw} おすすめ", f"{kw} ルーター 比較 レビュー"]
            queries = specific + queries

        result.append({
            **kw_data,
            "selected_query": queries[0],
            "search_queries": queries,
            "final_score": kw_data.get("count", 1),
        })

    return result


def _load_used_keywords() -> set:
    path = CACHE_DIR / "used_keywords.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        # 30日以内のものだけ除外対象
        from datetime import datetime, timedelta
        cutoff = (datetime.now() - timedelta(days=30)).isoformat()
        return {k for k, d in data.items() if d > cutoff}
    return set()


def _save_used_keyword(kw: str):
    path = CACHE_DIR / "used_keywords.json"
    data = {}
    if path.exists():
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    data[kw] = date.today().isoformat()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
