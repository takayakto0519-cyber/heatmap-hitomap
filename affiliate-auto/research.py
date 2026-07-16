"""
市場リサーチモジュール
- Gemini APIでトレンドキーワードと推奨商品を選定
- Amazon検索でASIN・価格・評価を取得
- 1日1回のAPI呼び出しに収める（無料枠保護）
"""
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from google import genai
from google.genai import types

from config import (
    GEMINI_API_KEY, GEMINI_MODEL, GEMINI_MAX_TOKENS_PER_CALL,
    TARGET_CATEGORIES, PRICE_RANGE_MIN, PRICE_RANGE_MAX,
    AMAZON_ASSOCIATE_TAG, AMAZON_BASE_URL, LOGS_DIR
)


def setup_gemini():
    client = genai.Client(api_key=GEMINI_API_KEY)
    return client


def research_keyword_and_products(model) -> dict:
    """
    Gemini APIで今日のキーワードと推奨商品を決定する。
    1回のAPI呼び出しで完結（無料枠節約）。
    """
    today = date.today().strftime("%Y年%-m月%-d日")
    categories_str = "\n".join(f"- {c}" for c in TARGET_CATEGORIES)

    prompt = f"""
あなたはAmazonアフィリエイト戦略の専門家です。
今日（{today}）のnote記事に最適なキーワードと商品を選んでください。

【ターゲット読者】
都市部に住む20〜30代のビジネスパーソン。
週末は地方でワーケーションや一人旅をしながら、対人ノイズから逃れ「余白」を求めている。

【カテゴリー候補】
{categories_str}

【単価条件】
¥{PRICE_RANGE_MIN:,}〜¥{PRICE_RANGE_MAX:,}の商品（手数料効率が高いもの）

【出力形式】以下のJSONのみを返してください（説明文不要）:
{{
  "keyword": "メインキーワード（検索ボリュームが見込める具体的なフレーズ）",
  "search_intent": "このキーワードで検索する人の悩み・意図（1文）",
  "article_angle": "記事の切り口・差別化ポイント（1文）",
  "products": [
    {{
      "name": "商品名（実在するAmazon取り扱い商品）",
      "amazon_search_query": "Amazon検索URL用クエリ",
      "estimated_price": 推定価格（整数・円）,
      "spec_highlight": "最も重要なスペック事実（1文）",
      "target_user": "この商品が必然となる人物像（1文）",
      "negative_point": "低評価レビューで多い不満（1文）"
    }}
  ],
  "comparison_axis": ["比較軸1", "比較軸2", "比較軸3"],
  "affiliate_hook": "成約率を高めるための記事の締め（1文）"
}}

必ず商品は3つ選んでください。価格帯は低・中・高の3段階で。
"""

    response = model.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(max_output_tokens=GEMINI_MAX_TOKENS_PER_CALL)
    )
    raw = response.text.strip()

    # JSON抽出
    json_match = re.search(r'\{[\s\S]+\}', raw)
    if not json_match:
        raise ValueError(f"JSON解析失敗。レスポンス:\n{raw}")

    result = json.loads(json_match.group())

    # Amazon商品URLを生成
    for p in result.get("products", []):
        query = urllib.parse.quote(p.get("amazon_search_query", p["name"]))
        p["amazon_search_url"] = f"{AMAZON_BASE_URL}/s?k={query}"
        if AMAZON_ASSOCIATE_TAG:
            p["amazon_search_url"] += f"&tag={AMAZON_ASSOCIATE_TAG}"

    # ログ保存
    log_path = LOGS_DIR / f"research_{date.today().isoformat()}.json"
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"[research] キーワード決定: {result['keyword']}")
    print(f"[research] 商品数: {len(result.get('products', []))}")
    return result


def enrich_products_with_amazon_data(research: dict) -> dict:
    """
    Amazon検索ページから実際のASIN・価格・評価を取得する。
    （スクレイピング: User-Agentを偽装せず、公開情報のみ取得）
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; affiliate-research-bot/1.0)",
        "Accept-Language": "ja-JP,ja;q=0.9",
    }

    enriched = []
    for p in research.get("products", []):
        try:
            url = p["amazon_search_url"]
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as res:
                html = res.read().decode("utf-8", errors="ignore")

            # ASIN抽出（Amazon検索結果の標準パターン）
            asin_match = re.search(r'data-asin="([A-Z0-9]{10})"', html)
            if asin_match:
                asin = asin_match.group(1)
                dp_url = f"{AMAZON_BASE_URL}/dp/{asin}"
                if AMAZON_ASSOCIATE_TAG:
                    dp_url += f"?tag={AMAZON_ASSOCIATE_TAG}"
                p["asin"] = asin
                p["amazon_product_url"] = dp_url
            else:
                p["amazon_product_url"] = p["amazon_search_url"]

            # 価格抽出（概算）
            price_match = re.search(r'￥([\d,]+)', html)
            if price_match:
                p["actual_price"] = int(price_match.group(1).replace(",", ""))

            # 評価抽出
            rating_match = re.search(r'(\d\.\d)つ星のうち', html)
            if rating_match:
                p["rating"] = float(rating_match.group(1))

            time.sleep(2)  # サーバー負荷軽減

        except Exception as e:
            print(f"[research] Amazon取得エラー ({p['name']}): {e}")
            p["amazon_product_url"] = p.get("amazon_search_url", AMAZON_BASE_URL)

        enriched.append(p)

    research["products"] = enriched
    return research
