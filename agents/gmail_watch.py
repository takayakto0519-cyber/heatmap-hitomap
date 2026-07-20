"""Gmail番人 — 会長のGmail（hitomap.info@gmail.com）を読み、自治体プロファイル
（municipality_profiles）ごとに「送信済みか」「返信が来ているか」を自動で確認し、
Supabaseの email_sent_at / email_reply を更新する。

【スコープは読み取り専用】(gmail.readonly)。このスクリプトはメールを一切
送信・削除・変更しない。憲法：AIが先に実行してから報告するような自律的な
外部行動をしない、を徹底する（読んで記録するだけ。送信は必ず会長の手で）。

対象は municipality_profiles テーブルのうち contact_email が入力されている行のみ。
その宛先とのスレッドを検索し、
  - こちらから送ったメールがあれば email_sent_at を埋める（未設定の場合のみ）
  - 実際に送信した本文を email_sent_content に反映する（毎回最新のものに更新）
  - 相手から届いた返信があれば、その本文を email_reply に反映する（毎回上書き）
  - 前回までemail_replyが空だった自治体に新しく返信が付いた場合、Discordに通知する
    （.env.localのHITOMAP_DISCORD_WEBHOOK_URLまたはDISCORD_WEBHOOK_URLを使用。未設定なら通知はスキップ）

初回のみ、資格情報(agents/secrets/gmail_client_secret.json)を使って
ブラウザでの同意（会長の手動クリック）が必要。以降はトークンをキャッシュし
無人で自動更新するので、Windowsタスクスケジューラでの定期実行に使える。

セットアップ手順は agents/secrets/README.md を参照。
"""
from __future__ import annotations

import json
import urllib.request
from email.utils import parseaddr

import common

SECRETS_DIR = common.AGENTS_DIR / "secrets"
CLIENT_SECRET_PATH = SECRETS_DIR / "gmail_client_secret.json"
TOKEN_PATH = SECRETS_DIR / "gmail_token.json"

# 読み取り専用スコープ。送信・削除・ラベル変更の権限は持たせない。
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
OWN_ADDRESS = "hitomap.info@gmail.com"


def _get_credentials():
    """トークンをキャッシュから読み、無ければ初回のみブラウザ同意を挟んで作る。
    2回目以降は refresh_token で無人更新するため、タスクスケジューラでの
    定期実行でも会長の手を煩わせない。calendar_watch.py と同じ流儀。"""
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


def _header(headers: list[dict], name: str) -> str:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _plain_text(payload: dict) -> str:
    """Gmail APIのpayloadから、テキスト本文を可能な範囲で抜き出す（簡易実装）。"""
    import base64

    def decode(data: str) -> str:
        try:
            return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="ignore")
        except Exception:
            return ""

    if payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        return decode(payload["body"]["data"])
    for part in payload.get("parts", []) or []:
        text = _plain_text(part)
        if text:
            return text
    return ""


def _check_thread_for_contact(service, contact_email: str) -> dict:
    """宛先とのやり取りを検索し、送信済みか・実際に送った本文・相手からの返信本文があるかを返す。"""
    query = f"to:{contact_email} OR from:{contact_email}"
    resp = service.users().threads().list(userId="me", q=query, maxResults=5).execute()
    thread_ids = [t["id"] for t in resp.get("threads", [])]
    if not thread_ids:
        return {"sent": False, "sent_content": None, "reply": None}

    sent = False
    sent_content = None
    sent_date = None
    reply_text = None
    reply_date = None
    for tid in thread_ids:
        thread = service.users().threads().get(userId="me", id=tid, format="full").execute()
        for msg in thread.get("messages", []):
            headers = msg.get("payload", {}).get("headers", [])
            sender = parseaddr(_header(headers, "From"))[1].lower()
            date = _header(headers, "Date")
            if sender == OWN_ADDRESS.lower():
                sent = True
                text = _plain_text(msg.get("payload", {})) or msg.get("snippet", "")
                if text and (sent_date is None or date > sent_date):
                    sent_content = text.strip()
                    sent_date = date
            elif sender == contact_email.lower():
                text = _plain_text(msg.get("payload", {})) or msg.get("snippet", "")
                if text and (reply_date is None or date > reply_date):
                    reply_text = text.strip()
                    reply_date = date
    return {"sent": sent, "sent_content": sent_content, "reply": reply_text}


def _send_discord_message(webhook_url: str, content: str) -> int:
    payload = {"username": "ヒトマップ Gmail番人", "content": content}
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "HitomapGmailWatch/1.0 (+https://github.com/hitomap)",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return res.status


def _notify_new_replies(env: dict, new_replies: list[dict]) -> str:
    webhook_url = env.get("HITOMAP_DISCORD_WEBHOOK_URL") or env.get("DISCORD_WEBHOOK_URL", "")
    if not webhook_url:
        return "未設定（.env.localにHITOMAP_DISCORD_WEBHOOK_URLを追加してください）"
    if not new_replies:
        return "新着返信なし（通知スキップ）"
    lines = [f"**📬 自治体から新しい返信が届きました（{len(new_replies)}件）**"]
    for r in new_replies:
        preview = r["reply"][:120].replace("\n", " ")
        lines.append(f"・{r['region_name']}：{preview}{'…' if len(r['reply']) > 120 else ''}")
    lines.append("運営ダッシュボードの「関係人口」タブで全文を確認してください。")
    try:
        status = _send_discord_message(webhook_url, "\n".join(lines))
        return str(status)
    except Exception as e:
        return f"投稿エラー: {e}"


def _supabase_request(env: dict, method: str, path: str, body: dict | None = None) -> None:
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        data=data, method=method,
        headers={
            "apikey": key, "Authorization": f"Bearer {key}",
            "Content-Type": "application/json", "Prefer": "return=minimal",
        },
    )
    with urllib.request.urlopen(req, timeout=15):
        pass


def main():
    with common.running("gmail_watch"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            common.write_result("gmail_watch", {"connected": False, "error": "Supabase設定(.env.local)が見つかりません"})
            return

        try:
            creds = _get_credentials()
        except FileNotFoundError as e:
            common.write_result("gmail_watch", {"connected": False, "error": str(e), "checked": 0, "updated": 0})
            return
        except Exception as e:
            common.write_result("gmail_watch", {"connected": False, "error": f"Gmail認証に失敗しました: {e}", "checked": 0, "updated": 0})
            return

        from googleapiclient.discovery import build
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)

        req = urllib.request.Request(
            f"{url}/rest/v1/municipality_profiles?select=id,region_name,contact_email,email_sent_at,email_sent_content,email_reply&contact_email=not.is.null",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=20) as res:
            profiles = json.loads(res.read())

        checked, updated, errors = 0, 0, []
        new_replies = []
        for p in profiles:
            contact = (p.get("contact_email") or "").strip()
            if not contact:
                continue
            checked += 1
            try:
                status = _check_thread_for_contact(service, contact)
            except Exception as e:
                errors.append({"region_name": p["region_name"], "error": str(e)})
                continue

            patch = {}
            if status["sent"] and not p.get("email_sent_at"):
                from datetime import datetime, timezone
                patch["email_sent_at"] = datetime.now(timezone.utc).isoformat()
            if status["sent_content"] and status["sent_content"] != (p.get("email_sent_content") or ""):
                patch["email_sent_content"] = status["sent_content"]
            if status["reply"] and status["reply"] != (p.get("email_reply") or ""):
                patch["email_reply"] = status["reply"]
                new_replies.append({"region_name": p["region_name"], "reply": status["reply"]})

            if patch:
                _supabase_request(env, "PATCH", f"municipality_profiles?id=eq.{p['id']}", patch)
                updated += 1

        notify_result = _notify_new_replies(env, new_replies)

        common.write_result("gmail_watch", {
            "connected": True,
            "checked": checked,
            "updated": updated,
            "new_replies": len(new_replies),
            "notify_result": notify_result,
            "errors": errors,
        })


if __name__ == "__main__":
    main()
