"""
note.com 自動投稿モジュール
- launch_persistent_context でログインセッションを保存
- 初回は headless=False でログイン → 以降は headless=True で自動実行
"""
import sys
import json
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from config import NOTE_EMAIL, NOTE_PASSWORD, DRAFT_ONLY, LOGS_DIR

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3] });
Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja'] });
window.chrome = { runtime: {} };
"""

# ログインセッションを保存するプロファイルディレクトリ
_PROFILE_DIR = Path(__file__).parent / "chrome_profile_note"
_PROFILE_DIR.mkdir(exist_ok=True)


def post_to_note(article: dict) -> str:
    """
    note.com に記事を投稿または下書き保存する。
    初回実行時は headless=False でログイン画面が開くのでブラウザで手動ログインする。
    以降はセッションが保存されるので headless で自動実行される。
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return "playwright 未インストール: pip install playwright && playwright install chromium"

    title = article.get("title", "")
    body  = article.get("body", "")
    tags  = article.get("tags", [])

    print(f"[note_poster] 投稿開始: {title[:50]}")

    with sync_playwright() as p:
        # persistent_context でセッションを保持
        ctx = p.chromium.launch_persistent_context(
            str(_PROFILE_DIR),
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
            viewport={"width": 1280, "height": 900},
            locale="ja-JP",
            user_agent=_UA,
        )
        ctx.add_init_script(_STEALTH_JS)
        page = ctx.new_page()

        try:
            # ── ログイン状態チェック ──
            page.goto("https://note.com", wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(1500)

            is_logged_in = page.locator('[data-testid="user-icon"], .o-userIcon, [aria-label*="マイページ"]').count() > 0
            if not is_logged_in:
                print("[note_poster] 未ログイン — ログイン試行中...")
                page.goto("https://note.com/login", wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(1500)

                # メールログインフォーム
                for email_sel in ['input[name="email"]', 'input[type="email"]']:
                    if page.locator(email_sel).count() > 0:
                        page.fill(email_sel, NOTE_EMAIL)
                        page.fill('input[name="password"], input[type="password"]', NOTE_PASSWORD)
                        page.click('button[type="submit"]')
                        page.wait_for_load_state("networkidle", timeout=20000)
                        page.wait_for_timeout(2000)
                        print(f"[note_poster] ログイン後URL: {page.url}")
                        break

                # Googleログインボタンがあればメール/パスに戻す
                if "login" in page.url:
                    print("[note_poster] ⚠ ログイン失敗 — セッション保存なし")
                    _take_screenshot(page, "login_failed")
                    return "ログイン失敗（初回はブラウザで手動ログインが必要な場合があります）"
            else:
                print("[note_poster] ログイン済みセッション確認")

            # ── 新規記事作成ページへ ──────────────────────────
            page.goto("https://note.com/notes/new", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            if "login" in page.url:
                _take_screenshot(page, "new_note_redirect")
                return f"ログインセッション期限切れ: {page.url}"

            # ── タイトル入力 ──────────────────────────────────
            for sel in [
                'textarea[placeholder*="タイトル"]',
                'input[placeholder*="タイトル"]',
                '.NoteNew-titleInput',
                '[data-placeholder*="タイトル"]',
            ]:
                if page.locator(sel).count() > 0:
                    page.locator(sel).first.fill(title)
                    page.wait_for_timeout(500)
                    print("[note_poster] タイトル入力完了")
                    break
            else:
                print("[note_poster] ⚠ タイトル欄が見つかりません")
                _take_screenshot(page, "no_title_input")

            # ── 本文入力 ──────────────────────────────────────
            for sel in ['.ProseMirror', '[contenteditable="true"]', 'div[role="textbox"]']:
                if page.locator(sel).count() > 0:
                    editor = page.locator(sel).first
                    editor.click()
                    page.wait_for_timeout(300)
                    # クリップボード経由ペースト
                    page.evaluate(
                        """async (text) => {
                            try { await navigator.clipboard.writeText(text); }
                            catch (e) {
                                const ta = document.createElement('textarea');
                                ta.value = text; document.body.appendChild(ta);
                                ta.select(); document.execCommand('copy');
                                document.body.removeChild(ta);
                            }
                        }""",
                        body,
                    )
                    page.keyboard.press("Control+a")
                    page.keyboard.press("Delete")
                    page.keyboard.press("Control+v")
                    page.wait_for_timeout(1500)
                    print("[note_poster] 本文入力完了")
                    break
            else:
                print("[note_poster] ⚠ 本文エディターが見つかりません")

            # ── タグ設定 ──────────────────────────────────────
            for sel in ['input[placeholder*="タグ"]', '.TagInput input', 'input[name="tag"]']:
                if page.locator(sel).count() > 0:
                    tag_input = page.locator(sel).first
                    for tag in tags[:5]:
                        tag_input.fill(tag)
                        page.keyboard.press("Enter")
                        page.wait_for_timeout(300)
                    print(f"[note_poster] タグ設定: {tags[:5]}")
                    break

            page.wait_for_timeout(1000)

            # ── 公開 or 下書き保存 ────────────────────────────
            if DRAFT_ONLY:
                for sel in ['button:has-text("下書き保存")', 'button:has-text("保存")']:
                    if page.locator(sel).count() > 0:
                        page.locator(sel).first.click()
                        page.wait_for_timeout(2000)
                        print("[note_poster] 下書き保存完了")
                        break
                status = "下書き保存完了"
            else:
                for sel in ['button:has-text("公開")', 'button.o-btn-publish', '[data-cy="publish"]']:
                    if page.locator(sel).count() > 0:
                        page.locator(sel).first.click()
                        page.wait_for_timeout(2000)
                        for csel in ['button:has-text("公開する")', 'button:has-text("投稿する")']:
                            if page.locator(csel).count() > 0:
                                page.locator(csel).first.click()
                                break
                        page.wait_for_timeout(3000)
                        print(f"[note_poster] 公開完了: {page.url}")
                        break
                status = f"公開完了: {page.url}"

            # ログ保存
            (LOGS_DIR / f"post_{date.today().isoformat()}.json").write_text(
                json.dumps({
                    "title":  title,
                    "status": "draft" if DRAFT_ONLY else "published",
                    "url":    page.url,
                    "date":   date.today().isoformat(),
                }, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            page.wait_for_timeout(1000)
            return status

        except Exception as e:
            print(f"[note_poster] エラー: {e}")
            _take_screenshot(page, "error")
            return f"投稿エラー: {e}"

        finally:
            ctx.close()


def _take_screenshot(page, label: str):
    try:
        path = LOGS_DIR / f"{label}_{date.today().isoformat()}.png"
        page.screenshot(path=str(path))
        print(f"[note_poster] スクリーンショット: {path}")
    except Exception:
        pass


def post(article: dict) -> str:
    return post_to_note(article)
