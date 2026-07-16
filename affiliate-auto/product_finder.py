"""
Amazon スクレイパー — Playwright(Chrome)優先、requests フォールバック

Playwright を使うことで bot 検知を回避し、
検索 + 商品詳細（タイトル・スペック・低評価レビュー）を
1 Chrome セッションで一括取得する。
"""
import re
import json
import time
import random
from typing import List, Dict, Optional
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from config import AMAZON_BASE_URL, AMAZON_ASSOCIATE_TAG, CACHE_DIR, PRICE_RANGE_MIN, PRICE_RANGE_MAX

MIN_REVIEWS = 5

_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3] });
Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja', 'en-US'] });
window.chrome = { runtime: {} };
"""
_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
_HEADERS = {
    "User-Agent": _UA,
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "ja-JP,ja;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.amazon.co.jp/",
    "DNT": "1",
}


# ─── 公開 API ───────────────────────────────────────────────────────────────

def search_amazon(query: str, max_results: int = 5) -> List[Dict]:
    """
    Chrome(Playwright) で Amazon 検索 + 商品詳細を 1 セッションで一括取得。
    各商品に title / asin / price / rating / reviews / features / bad_reviews / url / image が入る。
    Playwright 失敗時は requests + BeautifulSoup にフォールバック。
    """
    cache_key  = re.sub(r"[^\w]", "_", query)
    cache_path = CACHE_DIR / f"pw_amazon_{cache_key}.json"

    if cache_path.exists():
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        if (datetime.now().timestamp() - data.get("ts", 0)) < 21600:
            print(f"[product] キャッシュHIT: {query}")
            return data["products"]

    try:
        products = _scrape_playwright(query, max_results)
    except Exception as e:
        print(f"[product] Playwright 失敗({e}) → requests 版にフォールバック")
        products = _scrape_requests(query, max_results)

    if not products:
        products = _fallback_products(query)

    cache_path.write_text(
        json.dumps({"ts": datetime.now().timestamp(), "products": products},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    rev_cnt = sum(1 for p in products if int(p.get("reviews", 0) or 0) >= MIN_REVIEWS)
    print(f"[product] 取得: {len(products)}件 (レビューあり:{rev_cnt}件) [{query}]")
    return products


def get_product_details(asin: str) -> Dict:
    """後方互換 — search_amazon が詳細込みで返すので通常は呼ばれない"""
    cache_path = CACHE_DIR / f"pw_detail_{asin}.json"
    if cache_path.exists():
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        if (datetime.now().timestamp() - data.get("ts", 0)) < 86400:
            return data["detail"]
    detail = {"asin": asin, "title": "", "features": [], "bad_reviews": []}
    try:
        resp = requests.get(f"{AMAZON_BASE_URL}/dp/{asin}", headers=_HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")
        for sel in ["#productTitle", "#title span"]:
            el = soup.select_one(sel)
            if el:
                detail["title"] = el.get_text(strip=True)[:100]
                break
        bullets = soup.select("#feature-bullets li span.a-list-item")
        detail["features"] = [b.get_text(strip=True) for b in bullets[:5]
                               if len(b.get_text(strip=True)) > 5]
        for rev in soup.select("[data-hook='review']"):
            s_el = rev.select_one("[data-hook='review-star-rating'] .a-icon-alt")
            if s_el and _parse_rating(s_el.get_text()) <= 3.0:
                b_el = rev.select_one("[data-hook='review-body'] span")
                if b_el:
                    detail["bad_reviews"].append(b_el.get_text(strip=True)[:200])
    except Exception as e:
        print(f"[product] 詳細フォールバックエラー {asin}: {e}")
    cache_path.write_text(
        json.dumps({"ts": datetime.now().timestamp(), "detail": detail},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return detail


def clear_cache(query: str = None):
    """キャッシュ削除（query=None で全削除）"""
    if query:
        cache_key = re.sub(r"[^\w]", "_", query)
        for pat in [f"pw_amazon_{cache_key}.json", f"amazon_{cache_key}.json"]:
            p = CACHE_DIR / pat
            if p.exists():
                p.unlink()
                print(f"[product] キャッシュ削除: {pat}")
    else:
        for p in list(CACHE_DIR.glob("pw_amazon_*.json")) + list(CACHE_DIR.glob("amazon_*.json")):
            p.unlink()
        print("[product] 全 Amazon キャッシュ削除")


# ─── Playwright 実装 ────────────────────────────────────────────────────────

def _scrape_playwright(query: str, max_results: int) -> List[Dict]:
    from playwright.sync_api import sync_playwright

    products = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled",
                  "--no-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="ja-JP",
            user_agent=_UA,
        )
        ctx.add_init_script(_STEALTH_JS)
        page = ctx.new_page()

        try:
            # ── 検索ページ ──
            search_url = (f"{AMAZON_BASE_URL}/s?k={query}"
                          f"&i=electronics&s=review-rank&language=ja_JP")
            page.goto(search_url, wait_until="domcontentloaded", timeout=25000)
            page.wait_for_timeout(random.randint(1500, 2500))

            if "ロボット" in page.title() or "CAPTCHA" in page.content():
                print("[product] CAPTCHA 検知 — requests にフォールバック")
                return []

            cards = page.query_selector_all('[data-component-type="s-search-result"]')
            print(f"[product] 検索カード: {len(cards)}件 [{query}]")

            candidates = []
            for card in cards[:max_results * 3]:
                prod = _parse_card_pw(card)
                if prod and _in_price_range(prod["price"]):
                    candidates.append(prod)

            with_rev    = [x for x in candidates if int(x.get("reviews", 0) or 0) >= MIN_REVIEWS]
            without_rev = [x for x in candidates if int(x.get("reviews", 0) or 0) < MIN_REVIEWS]
            selected    = (with_rev + without_rev)[:max_results]

            # ── 各商品の詳細ページ（同セッションで取得）──
            for prod in selected:
                if not prod.get("asin"):
                    continue
                try:
                    page.goto(f"{AMAZON_BASE_URL}/dp/{prod['asin']}",
                              wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(random.randint(800, 1500))

                    # タイトル補完
                    if not prod.get("title"):
                        for sel in ["#productTitle", "#title span",
                                    "h1 span[class*='a-size']"]:
                            el = page.query_selector(sel)
                            if el:
                                t = el.inner_text().strip()
                                if len(t) > 3:
                                    prod["title"] = t[:100]
                                    break

                    # 評価補完
                    if not prod.get("rating"):
                        el = page.query_selector(
                            "#acrPopover [title], [data-hook='rating-out-of-text']"
                        )
                        if el:
                            prod["rating"] = _parse_rating(
                                el.get_attribute("title") or el.inner_text()
                            )

                    # レビュー数補完
                    if not prod.get("reviews"):
                        el = page.query_selector("#acrCustomerReviewText")
                        if el:
                            digits = re.sub(r"[^\d]", "", el.inner_text())
                            if digits:
                                prod["reviews"] = int(digits)

                    # 商品特徴
                    bullets = page.query_selector_all(
                        "#feature-bullets li span.a-list-item"
                    )
                    if not bullets:
                        bullets = page.query_selector_all("#feature-bullets .a-list-item")
                    prod["features"] = [
                        b.inner_text().strip() for b in bullets[:5]
                        if len(b.inner_text().strip()) > 5
                    ]

                    # 低評価レビュー — 批判的レビュー専用ページから取得
                    bad_revs = []
                    if prod.get("asin"):
                        try:
                            rev_url = (f"{AMAZON_BASE_URL}/product-reviews/{prod['asin']}"
                                       f"?filterByStar=critical&sortBy=recent&pageNumber=1")
                            page.goto(rev_url, wait_until="domcontentloaded", timeout=20000)
                            page.wait_for_timeout(random.randint(1200, 1800))
                            # レビューページの複数セレクターで試行
                            for rev in page.query_selector_all("[data-hook='review']")[:5]:
                                b_el = (
                                    rev.query_selector("[data-hook='review-body'] span") or
                                    rev.query_selector(".review-text-content span") or
                                    rev.query_selector(".review-text")
                                )
                                if b_el:
                                    txt = b_el.inner_text().strip()[:200]
                                    if len(txt) > 10:
                                        bad_revs.append(txt)
                        except Exception as re_err:
                            print(f"[product] 低評価取得エラー: {re_err}")
                    prod["bad_reviews"] = bad_revs

                except Exception as e:
                    print(f"[product] 詳細エラー {prod.get('asin')}: {e}")
                    prod.setdefault("features", [])
                    prod.setdefault("bad_reviews", [])

            products = selected

        except Exception as e:
            print(f"[product] Playwright 全体エラー: {e}")
        finally:
            browser.close()

    return products


def _parse_card_pw(card) -> Optional[Dict]:
    try:
        asin = card.get_attribute("data-asin") or ""
        if not asin:
            return None

        title = ""
        for sel in [
            "h2 a span",
            ".a-size-medium.a-color-base.a-text-normal",
            ".a-size-base-plus.a-color-base.a-text-normal",
            "h2 span",
            "[data-cy='title-recipe'] span",
        ]:
            el = card.query_selector(sel)
            if el:
                t = el.inner_text().strip()
                if len(t) > 3:
                    title = t[:100]
                    break
        if not title:
            img = card.query_selector("img.s-image")
            if img:
                alt = img.get_attribute("alt") or ""
                if len(alt) > 3:
                    title = alt[:100]

        price = 0
        for sel in [".a-price .a-offscreen", ".a-price-whole", ".a-color-price"]:
            el = card.query_selector(sel)
            if el:
                price = _parse_price(el.inner_text().strip())
                if price > 0:
                    break

        rating = 0.0
        for sel in [
            ".a-icon-star-small .a-icon-alt",
            ".a-icon-star .a-icon-alt",
            "[aria-label*='つ星']",
        ]:
            el = card.query_selector(sel)
            if el:
                t = el.get_attribute("aria-label") or el.inner_text().strip()
                r = _parse_rating(t)
                if r > 0:
                    rating = r
                    break

        reviews = 0
        for sel in [
            ".a-size-small .a-link-normal",
            "[href*='#customerReviews']",
            ".s-link-style .s-underline-text",
        ]:
            el = card.query_selector(sel)
            if el:
                t = el.inner_text().strip().replace(",", "").replace("件", "")
                if t.isdigit():
                    reviews = int(t)
                    break

        img_el = card.query_selector("img.s-image")
        image  = img_el.get_attribute("src") if img_el else ""

        return {
            "title": title, "asin": asin,
            "price": price, "rating": rating, "reviews": reviews,
            "image": image, "url": _affiliate_url(asin),
            "features": [], "bad_reviews": [],
        }
    except Exception as e:
        print(f"[product] カードパースエラー: {e}")
        return None


# ─── requests フォールバック ─────────────────────────────────────────────────

def _scrape_requests(query: str, max_results: int) -> List[Dict]:
    url    = f"{AMAZON_BASE_URL}/s"
    params = {"k": query, "i": "electronics", "s": "review-rank", "language": "ja_JP"}
    products = []
    try:
        resp = requests.get(url, params=params, headers=_HEADERS, timeout=15)
        resp.raise_for_status()
        soup  = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select('[data-component-type="s-search-result"]')
        candidates = []
        for card in cards[:max_results * 3]:
            prod = _parse_card_bs4(card)
            if prod and _in_price_range(prod["price"]):
                candidates.append(prod)
        with_rev    = [p for p in candidates if int(p.get("reviews", 0) or 0) >= MIN_REVIEWS]
        without_rev = [p for p in candidates if int(p.get("reviews", 0) or 0) < MIN_REVIEWS]
        products    = (with_rev + without_rev)[:max_results]
        time.sleep(1.5)
    except Exception as e:
        print(f"[product] requests 検索失敗: {e}")
    return products


def _parse_card_bs4(card) -> Optional[Dict]:
    try:
        asin = card.get("data-asin", "")
        if not asin:
            return None
        title = ""
        for sel in [
            "h2 a span", ".a-size-medium.a-color-base.a-text-normal",
            ".a-size-base-plus.a-color-base.a-text-normal", "h2 span",
            ".s-title-instructions-style span", "[data-cy='title-recipe'] span",
            ".s-line-clamp-4 span", ".s-line-clamp-2 span",
        ]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if len(t) > 3:
                    title = t[:100]
                    break
        if not title:
            img_el = card.select_one("img.s-image")
            if img_el:
                alt = img_el.get("alt", "")
                if len(alt) > 3:
                    title = alt[:100]
        price = 0
        for sel in [".a-price .a-offscreen", ".a-price-whole", ".a-color-price"]:
            el = card.select_one(sel)
            if el:
                price = _parse_price(el.get_text(strip=True))
                if price > 0:
                    break
        rating = 0.0
        for sel in [
            ".a-icon-star-small .a-icon-alt", ".a-icon-star .a-icon-alt",
            "[aria-label*='つ星']", ".a-star-small .a-icon-alt",
        ]:
            el = card.select_one(sel)
            if el:
                t = el.get("aria-label", "") or el.get_text(strip=True)
                r = _parse_rating(t)
                if r > 0:
                    rating = r
                    break
        reviews = 0
        for sel in [
            "[aria-label*='つ星のうち'] + span", ".a-size-small .a-link-normal",
            "[href*='#customerReviews']", ".s-link-style .s-underline-text",
        ]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True).replace(",", "").replace("件", "")
                if t.isdigit():
                    reviews = int(t)
                    break
        img_el = card.select_one("img.s-image")
        image  = img_el["src"] if img_el else ""
        return {
            "title": title, "asin": asin,
            "price": price, "rating": rating, "reviews": reviews,
            "image": image, "url": _affiliate_url(asin),
            "features": [], "bad_reviews": [],
        }
    except Exception as e:
        print(f"[product] BS4 パースエラー: {e}")
        return None


# ─── 共通ユーティリティ ──────────────────────────────────────────────────────

def _parse_price(text: str) -> int:
    nums = re.sub(r"[^\d]", "", text)
    return int(nums) if nums else 0


def _parse_rating(text: str) -> float:
    m = re.search(r"[\d.]+", text or "")
    return float(m.group()) if m else 0.0


def _in_price_range(price: int) -> bool:
    return price == 0 or PRICE_RANGE_MIN <= price <= PRICE_RANGE_MAX


def _affiliate_url(asin: str) -> str:
    base = f"{AMAZON_BASE_URL}/dp/{asin}"
    return f"{base}?tag={AMAZON_ASSOCIATE_TAG}" if AMAZON_ASSOCIATE_TAG else base


def _fallback_products(query: str) -> List[Dict]:
    import urllib.parse
    return [{
        "title":   f"{query} — Amazon検索結果",
        "asin":    "", "price": 0, "rating": 0.0, "reviews": 0, "image": "",
        "url":     f"{AMAZON_BASE_URL}/s?k={urllib.parse.quote(query)}&s=review-rank",
        "features": [], "bad_reviews": [],
    }]
