"""
note.com 初回ログインセットアップ
─────────────────────────────────
このスクリプトを一度だけ実行してください。
ブラウザが開くので、note.com に手動でログインして
ログイン後のページ（マイページなど）が表示されたら
このターミナルに戻って Enter を押してください。

以降は chrome_profile_note/ にセッションが保存され、
main.py から headless で自動投稿できるようになります。

実行方法:
    python login_note_once.py
"""
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROFILE_DIR = Path(__file__).parent / "chrome_profile_note"
PROFILE_DIR.mkdir(exist_ok=True)

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


def setup_login():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright がインストールされていません")
        print("pip install playwright && playwright install chromium")
        return

    print("=" * 50)
    print("note.com 初回ログインセットアップ")
    print("=" * 50)
    print(f"プロファイル保存先: {PROFILE_DIR}")
    print()
    print("ブラウザが開きます。note.com にログインしてください。")
    print("ログイン完了後、このターミナルで Enter を押してください。")
    print()

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(PROFILE_DIR),
            headless=False,
            viewport={"width": 1280, "height": 900},
            locale="ja-JP",
            user_agent=_UA,
        )
        page = ctx.new_page()
        page.goto("https://note.com/login")

        input(">>> ブラウザでログイン後、Enter を押してください: ")

        # 現在のURLでログイン確認
        current_url = page.url
        print(f"現在のURL: {current_url}")

        if "login" not in current_url:
            print("✅ ログイン成功！セッションを保存しました。")
            print(f"   次回から python main.py で自動投稿されます。")
        else:
            print("⚠ まだログインページにいます。再度試してください。")

        ctx.close()


if __name__ == "__main__":
    setup_login()
