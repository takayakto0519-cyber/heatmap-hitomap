"""
GPTsプロンプト生成エンジン
RSS+MLで収集したデータを構造化し、GPTsに送る「型」プロンプトを出力する
GPTs側が記事を書く。このモジュールはデータ整形のみ担当。
"""
import json
from datetime import date
from pathlib import Path
from typing import List, Dict

from config import DRAFTS_DIR, AMAZON_ASSOCIATE_TAG


def check_data_quality(products: List[Dict]) -> dict:
    """商品データの品質を判定。問題があれば警告を返す"""
    named    = [p for p in products if p.get("title") and len(str(p["title"])) > 3]
    reviewed = [p for p in products if int(p.get("reviews", 0) or 0) >= 5]
    with_spec = [p for p in products if p.get("features")]

    warnings = []
    if len(named) < len(products):
        warnings.append(f"⚠️ タイトル未取得: {len(products)-len(named)}件 — Amazon側のHTML変更の可能性あり")
    if not reviewed:
        warnings.append("⚠️ レビュー付き商品: 0件 — 新着商品のみ取得 or Amazonがbot検知している可能性あり")
    if not with_spec:
        warnings.append("⚠️ スペック詳細: 0件")

    return {
        "ok":       len(named) >= 2,
        "named":    len(named),
        "reviewed": len(reviewed),
        "warnings": warnings,
    }


def build_gpts_prompt(keyword_data: Dict, products: List[Dict]) -> Dict:
    """
    キーワード+商品データ → GPTsに送るプロンプトを生成
    戻り値: {prompt, title_hint, keyword, date, draft_path}
    """
    kw    = keyword_data["keyword"]
    today = date.today().strftime("%Y%m%d")

    prompt = _build_prompt(kw, products, keyword_data)

    result = {
        "keyword":    kw,
        "date":       today,
        "title_hint": f"【{date.today().year}年版】{kw} — 比較と選び方",
        "prompt":     prompt,
        "products":   products,
    }

    # 下書き保存
    path = DRAFTS_DIR / f"prompt_{today}_{kw}.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    result["draft_path"] = str(path)

    print(f"[builder] GPTsプロンプト生成完了: {kw} ({len(prompt)}文字)")
    return result


def _build_prompt(kw: str, products: List[Dict], kw_data: Dict) -> str:
    product_block = _format_products(products)
    search_query  = kw_data.get("selected_query", kw)
    sample_titles = kw_data.get("sample_titles", [])
    trend_context = "\n".join(f"- {t}" for t in sample_titles[:3]) if sample_titles else "（トレンド情報なし）"

    return f"""# note記事執筆依頼

## あなたの役割
未購入者として、Amazon上の客観データ（スペック・低評価レビュー）だけを根拠に、
「この商品がこの人に必然である」と論理的に証明するnote記事を書いてください。

## 絶対ルール
- 実際に買った・使ったという表現は一切使わない
- 感情的な褒め言葉（すごい・最高・おすすめ）は使わない
- 根拠は「Amazonスペック」「購入者の低評価レビュー」「物理的事実」のみ
- 記事冒頭に「本記事はAmazon公開情報の客観分析です。実機レビューではありません」の免責を必ず入れる
- Amazonリンクは以下の商品データにある実URLをそのまま使う（変更不可）

## 今日のキーワード
**{kw}**

## 今日のトレンド背景（RSSから取得）
{trend_context}

## 対象商品データ（Amazon取得）
{product_block}

---

## 記事構成：PASONA型（日本最強のアフィリエイト構成）

### 【0. 結論ファースト（冒頭50字以内）】
スマホ読者は3秒で離脱する。最初の1文で「誰向けの記事か」を断言する。
例：「{kw.split()[0]}で失敗する人は、全員スペックではなく"シーン"を見ていない。」

### 【免責（2行以内）】
「本記事はAmazon公開情報の客観分析です。実機レビューではありません。」

### 【1. P：Problem（問題）】
「{kw}」を検索する人が抱える、具体的な1つの失敗シーンを描写する。
- 数値で語る（「2時間で肩が限界」「新幹線3時間で集中力が切れる」など）
- シーンを具体的に：場所・時間・体の状態まで書く

### 【2. A：Agitation（問題の深掘り）】
その失敗が「なぜ起きるか」を構造で説明する。
- 感情ではなく物理・構造の話にする
- 低評価レビューの実例を1〜2件引用して「他の人も同じ失敗をした事実」を示す

### 【3. S：Solution（解決策の提示）】
「スペックと低評価の両方を見れば、自分に合う1台が論理的に絞れる」という視点を提示。
この記事で何が分かるかを3行以内で明示。

### 【4. 比較表（Markdown表）】
| 商品名 | 価格 | 評価 | 向く人 | 向かない人 | Amazonリンク |
上記の商品データを使って作成。「向く人/向かない人」列が最重要。

### 【5. 商品別詳細（各300〜400字）】
各商品を以下の順で書く：
① スペックの客観事実（数値のみ）
② 低評価レビューが示す「向かない人の条件」
③ 逆算で「向く人の条件」を断言

### 【6. O：Offer（具体的提案）】
予算帯別の結論を出す。
- 1万円台で探している人 → ○○（Amazonリンク）
- 3万円台で探している人 → ○○（Amazonリンク）
- 妥協したくない人 → ○○（Amazonリンク）

### 【7. N：Narrowing（絞り込み・あなた向け判定）】
これが最重要。「あなたが〇〇なら、この記事の答えはこれだ」と明言する。
以下の形式で書く：
> ✅ **{kw.split()[0]}を毎日使う人** → [商品名]（[理由1文]）
> ✅ **週1〜2回の使用** → [商品名]（[理由1文]）
> ❌ **[条件]の人には全商品が不向き**（[代替案1文]）

### 【8. 買い替えサイン（伸びる記事の必須要素）】
「今の{kw.split()[0]}をいつ買い替えるべきか」の判断基準を3つ書く。
例：「〇〇な症状が出たら買い替えどき」→ CVR直結

### 【9. FAQ（3問）】
読者が検索しそうな具体的な疑問3つ。
Q: ○○ですか？ A: ○○（根拠つきで20〜30字）

### 【10. A：Action（今すぐ動く理由）】
「なぜ今選ぶべきか」の理由を1文で書く（価格変動・在庫・時期など）。
最後のCTA：「[条件]の人はこちら → [Amazonリンク]」

### 【11. アフィリエイト開示（末尾）】
「本記事にはAmazonアソシエイトリンクが含まれます」

---

## 文字数目安
3000〜4000字（note で読まれる上限付近）

## noteタイトル案（3パターン出力）
SEOとCTRを両立するタイトルを3案書いてください。
- 数字入り（「〇つのポイント」「〇万円以下」など）
- 失敗回避型（「〇〇で失敗する人の共通点」）
- 断言型（「〇〇を買う前に知っておくべき1つの事実」）

## 出力形式
note.comにそのまま貼り付けられるMarkdown形式で出力してください。
"""


def _format_products(products: List[Dict]) -> str:
    if not products:
        return "（商品データ未取得 — Amazon検索で手動補完してください）"

    # 品質チェック結果を先頭に付与
    quality = check_data_quality(products)
    quality_note = ""
    if quality["warnings"]:
        quality_note = "【データ品質注意】\n" + "\n".join(quality["warnings"]) + "\n\n"

    blocks = []
    for i, p in enumerate(products[:5], 1):
        title     = p.get("title") or f"商品{i}（タイトル未取得）"
        price_str = f"¥{p['price']:,}" if p.get("price") else "価格要確認"
        rating    = p.get("rating", "—")
        reviews   = p.get("reviews", 0)
        review_str = f"{reviews}件" if reviews else "レビューなし（新着 or 取得失敗）"
        url       = p.get("url", "")
        features  = p.get("features", [])
        bad_revs  = p.get("bad_reviews", [])

        feat_str = "\n  ".join(features[:3]) if features else "（スペック詳細は商品ページ参照）"
        bad_str  = "\n  ".join([f'「{r[:80]}」' for r in bad_revs[:2]]) if bad_revs else "（低評価データ未取得）"

        blocks.append(f"""### 商品{i}: {str(title)[:60]}
- 価格: {price_str}
- Amazon評価: ⭐{rating}  レビュー数: {review_str}
- スペック:
  {feat_str}
- 低評価レビュー実例:
  {bad_str}
- AmazonURL（そのまま使用）: {url}""")

    return quality_note + "\n\n".join(blocks)


# article_builder との互換エイリアス（main.py から呼び出される）
def build_article(keyword_data: Dict, products: List[Dict]) -> Dict:
    result = build_gpts_prompt(keyword_data, products)
    # main.py が期待するキーに合わせる
    result["title"]      = result["title_hint"]
    result["body"]       = result["prompt"]
    result["tags"]       = _build_tags(keyword_data["keyword"])
    result["meta_desc"]  = f"{keyword_data['keyword']} — Amazon客観データ分析記事"
    return result


def _build_tags(kw: str) -> List[str]:
    base = [kw, "比較", "おすすめ", "ワーケーション", "リモートワーク", "ガジェット"]
    return base[:8]
