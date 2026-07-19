"""カレンダー番人 — 会長のGoogleカレンダー（hitomap.info@gmail.com）から
今日・明日の予定を読み、agents/work/calendar_watch.json に書き出す。

【スコープは読み取り専用】(calendar.readonly)。このスクリプトは予定を
一切作成・変更・削除しない。憲法：AIが先に実行してから報告するような
自律的な外部行動をしない、を徹底する（読むだけは越境しない）。

初回のみ、資格情報(agents/secrets/calendar_client_secret.json)を使って
ブラウザでの同意（会長の手動クリック）が必要。以降はトークンをキャッシュし
無人で自動更新するので、Windowsタスクスケジューラでの定期実行に使える。

セットアップ手順は agents/secrets/README.md を参照。
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import common

SECRETS_DIR = common.AGENTS_DIR / "secrets"
CLIENT_SECRET_PATH = SECRETS_DIR / "calendar_client_secret.json"
TOKEN_PATH = SECRETS_DIR / "calendar_token.json"

# 読み取り専用スコープ。予定の作成・変更権限は持たせない。
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
CALENDAR_ID = "hitomap.info@gmail.com"
JST = timezone(timedelta(hours=9))


def _get_credentials():
    """トークンをキャッシュから読み、無ければ初回のみブラウザ同意を挟んで作る。
    2回目以降は refresh_token で無人更新するため、タスクスケジューラでの
    定期実行でも会長の手を煩わせない。"""
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow

    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
        return creds

    if not CLIENT_SECRET_PATH.exists():
        raise FileNotFoundError(
            f"{CLIENT_SECRET_PATH} が見つかりません。"
            "agents/secrets/README.md の手順でOAuthクライアントを作成し配置してください。"
        )

    # ここでブラウザが開き、会長がGoogleアカウントでログイン・同意する（初回のみの手動操作）。
    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_PATH), SCOPES)
    creds = flow.run_local_server(port=0)
    SECRETS_DIR.mkdir(exist_ok=True)
    TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
    return creds


def _fetch_events(creds, start: datetime, end: datetime) -> list[dict]:
    from googleapiclient.discovery import build

    service = build("calendar", "v3", credentials=creds, cache_discovery=False)
    resp = (
        service.events()
        .list(
            calendarId=CALENDAR_ID,
            timeMin=start.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=50,
        )
        .execute()
    )
    events = []
    for e in resp.get("items", []):
        start_info = e.get("start", {})
        end_info = e.get("end", {})
        events.append({
            "title": e.get("summary", "(無題の予定)"),
            "start": start_info.get("dateTime") or start_info.get("date"),
            "end": end_info.get("dateTime") or end_info.get("date"),
            "all_day": "date" in start_info,
            "location": e.get("location", ""),
            "html_link": e.get("htmlLink", ""),
        })
    return events


def main():
    with common.running("calendar_watch"):
        now = datetime.now(JST)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        window_end = today_start + timedelta(days=2)  # 今日・明日ぶん

        try:
            creds = _get_credentials()
            events = _fetch_events(creds, today_start, window_end)
        except FileNotFoundError as e:
            common.write_result("calendar_watch", {
                "connected": False,
                "error": str(e),
                "events": [],
            })
            return
        except Exception as e:
            common.write_result("calendar_watch", {
                "connected": False,
                "error": f"カレンダー取得に失敗しました: {e}",
                "events": [],
            })
            return

        today = [ev for ev in events if (ev["start"] or "")[:10] == now.strftime("%Y-%m-%d")]
        tomorrow_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        tomorrow = [ev for ev in events if (ev["start"] or "")[:10] == tomorrow_str]

        common.write_result("calendar_watch", {
            "connected": True,
            "calendar_id": CALENDAR_ID,
            "today": today,
            "tomorrow": tomorrow,
            "as_of": now.strftime("%Y-%m-%d %H:%M"),
        })


if __name__ == "__main__":
    main()
