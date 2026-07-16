"""
メインオーケストレーター（完全自動版）
毎朝7時にタスクスケジューラから実行される

フロー:
  1. RSSフェッチ & トレンドスコアリング
  2. ML（TF-IDF）でキーワード候補TOP5を取得
  3. 各キーワードに対してAmazon商品スクレイピング（Playwright）
  4. Claude API で記事本文を自動生成（APIキー未設定時はGPTsプロンプトのみ）
  5. note.com下書き投稿（1件目のみ）
  6. ダッシュボード auto_data.js 更新
"""
import sys
import io
import json
import traceback
from datetime import datetime
from pathlib import Path

# Windows CP932 ターミナルで Unicode 文字が壊れないよう UTF-8 に固定
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from config import DRAFTS_DIR, LOGS_DIR, DRAFT_ONLY

RUNNING_FLAG = Path(__file__).parent / "work" / "running.flag"


def main():
    today = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = LOGS_DIR / f"run_{today}.log"

    def log(msg: str):
        print(msg)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}\n")

    RUNNING_FLAG.parent.mkdir(exist_ok=True)
    RUNNING_FLAG.write_text(datetime.now().isoformat(), encoding="utf-8")

    log("=" * 50)
    log("ヒトマップ アフィリエイト自動生成 開始（5KW一括）")
    log("=" * 50)

    try:
        # ── Step 1: RSSフェッチ & トレンドスコアリング ──
        log("[1/5] RSSフィード取得中...")
        from rss_fetcher import fetch_all_feeds, score_items, extract_trending_keywords
        rss_items = fetch_all_feeds(max_age_hours=24)
        scored    = score_items(rss_items)
        trending  = extract_trending_keywords(scored, top_n=5)
        log(f"      → {len(rss_items)}記事取得 / トレンドKW: {[k['keyword'] for k in trending]}")

        # ── Step 2: MLキーワード候補TOP5 取得 ──
        log("[2/5] MLキーワード選定中（5件）...")
        from keyword_selector import prepare_all_keywords
        kw_list = prepare_all_keywords(trending, rss_items=rss_items)
        log(f"      → 処理対象KW: {[k['keyword'] for k in kw_list]}")

        # ── Step 3-5: 各キーワードを一括処理 ──
        log("[3/5] Amazon商品検索 & 記事生成中（5KW）...")
        from product_finder import search_amazon, clear_cache
        from article_builder import build_article, check_data_quality
        from article_generator import generate_article
        from config import ANTHROPIC_API_KEY

        ai_mode = bool(ANTHROPIC_API_KEY)
        log(f"      → 記事生成モード: {'Claude API 自動生成' if ai_mode else 'GPTsプロンプト（APIキー未設定）'}")

        all_entries = []
        for i, kw_data in enumerate(kw_list, 1):
            kw = kw_data["keyword"]
            log(f"  [{i}/5] {kw} 処理中...")

            query    = kw_data.get("selected_query", kw)
            products = search_amazon(query, max_results=5)

            # 品質チェック & 再試行
            quality = check_data_quality(products)
            if quality["reviewed"] == 0:
                for rq in [q for q in kw_data.get("search_queries", []) if q != query][:1]:
                    log(f"         → 再試行: {rq}")
                    clear_cache(rq)
                    p2 = search_amazon(rq, max_results=5)
                    q2 = check_data_quality(p2)
                    if q2["reviewed"] > 0 or q2["named"] > quality["named"]:
                        products, quality = p2, q2
                        break

            article = build_article(kw_data, products)
            gpts_prompt = article.get("body", "")

            # Claude API で記事本文を生成（APIキーがあれば）
            body_text, is_ai = generate_article(gpts_prompt, keyword=kw)

            entry = {
                "index":       i,
                "date":        datetime.now().strftime("%Y-%m-%d %H:%M"),
                "keyword":     kw,
                "title":       article["title"],
                "prompt":      gpts_prompt,
                "body":        body_text,
                "is_ai":       is_ai,
                "products":    len(products),
                "draft_path":  article.get("draft_path", ""),
                "tags":        article.get("tags", []),
                "quality":     {"named": quality["named"], "reviewed": quality["reviewed"]},
            }
            all_entries.append(entry)
            label = "AI生成" if is_ai else "プロンプト"
            log(f"         → 完了: 商品{len(products)}件 レビュー:{quality['reviewed']} [{label}] {len(body_text)}字")

        log(f"      → {len(all_entries)}件の記事生成完了")

        # ── Step 5: note.com投稿（1件目のみ） ──
        log("[4/5] note.com投稿中（1件目のみ）...")
        if all_entries:
            first = all_entries[0]
            note_article = {
                "title": first["title"],
                "body":  first.get("body") or first.get("prompt", ""),
                "tags":  first["tags"],
            }
            post_result = _post_to_note(note_article)
            all_entries[0]["post_result"] = post_result
            log(f"      → 結果: {post_result}")

        # ── Step 6: ダッシュボード更新 ──
        log("[5/5] ダッシュボード更新中...")
        _update_dashboard_log(all_entries)
        log("      → auto_data.js 更新完了")

        log("=" * 50)
        log(f"完了: {len(all_entries)}件のプロンプトをダッシュボードに保存")
        log("=" * 50)

    except Exception:
        tb = traceback.format_exc()
        log(f"[ERROR]\n{tb}")
        sys.exit(1)
    finally:
        RUNNING_FLAG.unlink(missing_ok=True)


def _post_to_note(article: dict) -> str:
    try:
        from note_poster import post_to_note
        return post_to_note(article)
    except Exception as e:
        print(f"[note] 投稿エラー（手動投稿してください）: {e}")
        try:
            import subprocess
            subprocess.run("clip", input=article["body"].encode("utf-8"), shell=True, check=True)
            print("[note] 本文をクリップボードにコピーしました")
        except Exception:
            pass
        return f"投稿失敗（手動投稿が必要）: {e}"


def _update_dashboard_log(all_entries: list):
    """
    ダッシュボードが読み込む auto_data.js を更新（5件一括）
    window._autoDataList = [...5件...]
    window._autoData     = 1件目（後方互換）
    """
    # results.json（履歴）
    results_path = Path(__file__).parent / "results.json"
    results = []
    if results_path.exists():
        try:
            results = json.loads(results_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    # 今日分を先頭に追加（5件まとめて1エントリ）
    batch_entry = {
        "date":     datetime.now().strftime("%Y-%m-%d %H:%M"),
        "keywords": [e["keyword"] for e in all_entries],
        "entries":  all_entries,
    }
    results.insert(0, batch_entry)
    results_path.write_text(
        json.dumps(results[:30], ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    # auto_data.js
    js_path = Path(__file__).parent.parent / "auto_data.js"
    js_content = (
        "// 自動生成ファイル — affiliate-auto/main.py が毎朝更新します\n"
        "window._autoDataList = " + json.dumps(all_entries, ensure_ascii=False, indent=2) + ";\n"
        "window._autoData = window._autoDataList[0] || null;\n"
    )
    js_path.write_text(js_content, encoding="utf-8")
    print(f"[dashboard] auto_data.js 更新: {len(all_entries)}件")


if __name__ == "__main__":
    main()
