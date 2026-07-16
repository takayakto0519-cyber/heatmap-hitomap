"""
記事生成モジュール — Gemini APIによる完全記事自動生成
広告コピーライティング手法（PAS式・PREP法・比較表・FAQ）を活用
未購入前提・客観分析型
"""
import json
import re
from datetime import date
from pathlib import Path

from google import genai
from google.genai import types

from config import (
    GEMINI_MODEL, GEMINI_MAX_TOKENS_PER_CALL,
    AMAZON_ASSOCIATE_TAG, DRAFTS_DIR
)


def generate_article(model, research: dict) -> dict:
    """
    リサーチデータから完全記事を1回のAPI呼び出しで生成する。
    広告コピーライティングのベストプラクティスを適用。
    """
    kw = research["keyword"]
    intent = research["search_intent"]
    angle = research["article_angle"]
    products = research["products"]
    axes = research.get("comparison_axis", ["価格", "スペック", "耐久性"])
    hook = research.get("affiliate_hook", "")
    today = date.today().strftime("%Y年%-m月%-d日")

    products_info = ""
    for i, p in enumerate(products, 1):
        products_info += f"""
商品{i}: {p['name']}
  推定価格: ¥{p.get('actual_price', p.get('estimated_price', '不明')):,}
  Amazonリンク: {p.get('amazon_product_url', p.get('amazon_search_url', ''))}
  評価: ★{p.get('rating', '—')}
  スペックのポイント: {p['spec_highlight']}
  この人に必然: {p['target_user']}
  低評価の主訴: {p['negative_point']}
"""

    prompt = f"""
あなたは月収100万円超えのトップアフィリエイターです。
以下の情報を元に、note.comに投稿するための完全な記事を書いてください。

【キーワード】{kw}
【検索意図】{intent}
【記事の切り口】{angle}
【比較軸】{', '.join(axes)}

【紹介商品データ】
{products_info}

【記事の絶対ルール】
1. 「実際に使ってみた」「購入しました」などの嘘の体験談は一切書かない
2. 公開スペックとAmazonユーザーレビューの客観的データのみを根拠にする
3. 記事冒頭に「本記事は公開データとレビュー分析に基づきます。筆者による実機購入は前提としていません」と明記
4. Amazonリンクは必ず本文中に自然な形で埋め込む

【使用するコピーライティング手法】
- 冒頭: PASフォーミュラ（Problem→Agitate→Solution）で読者の悩みを刺す
- 見出し: 数字・具体性・疑問形を使い「続きを読みたい」と思わせる
- 比較表: 3商品を{', '.join(axes)}で一覧比較（読者が一目で判断できる構造）
- 社会的証明: Amazon評価数・レビューの傾向（客観的事実として）
- FAQ: 読者が迷う3つの疑問に先手で回答
- CTA（行動喚起）: 「今すぐ確認する」「在庫を確認する」など具体的なリンク誘導
- 締め: {hook}

【出力フォーマット】
以下のJSONのみを返してください（説明文不要）:
{{
  "title": "記事タイトル（30文字前後・数字・具体性を含む）",
  "body": "note記事の本文（Markdown形式・2000〜3000文字）",
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
  "meta_description": "記事の説明文（120文字以内・検索結果に表示される）"
}}

本文には必ずAmazonリンクを商品ごとに含めてください。
リンクテキストは「▶ [商品名]をAmazonで確認する」の形式で。
"""

    response = model.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=GEMINI_MAX_TOKENS_PER_CALL,
            temperature=0.7
        )
    )
    raw = response.text.strip()

    # JSON抽出
    json_match = re.search(r'\{[\s\S]+\}', raw)
    if not json_match:
        raise ValueError(f"JSON解析失敗:\n{raw[:300]}")

    article = json.loads(json_match.group())

    # アフィリエイト免責表記を本文冒頭に追加
    disclaimer = (
        f"> **【免責・開示】** 本記事は公開スペックデータおよびAmazonユーザーレビューの客観的分析に基づいています。"
        f"筆者による実機購入・使用は前提としていません。{today}時点の情報です。"
        f"本記事にはAmazonアソシエイトリンクが含まれ、購入時に紹介料が発生します（商品価格に影響しません）。\n\n"
    )
    article["body"] = disclaimer + article["body"]

    # 下書き保存
    draft_path = DRAFTS_DIR / f"draft_{date.today().isoformat()}.json"
    with open(draft_path, "w", encoding="utf-8") as f:
        json.dump({
            "research": research,
            "article": article,
            "generated_at": date.today().isoformat()
        }, f, ensure_ascii=False, indent=2)

    print(f"[generator] 記事生成完了: {article['title']}")
    print(f"[generator] 文字数: {len(article['body'])}文字")
    print(f"[generator] 下書き保存: {draft_path}")
    return article
