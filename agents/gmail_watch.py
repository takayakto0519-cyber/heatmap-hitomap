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

【追加機能：日程調整の検知】(2026-07-21)
上記とは別に、受信箱全体（学校・法人宛も含む・直近2日分）から「日程調整を求めている」
返信をキーワードで検知し、calendar_watch.py が先に（06:50）書き出した空き日情報と
突き合わせて「空いてそうな日」を1回のDiscord通知にまとめる。ここも読み取り専用のまま
（メールの送信・下書き作成は一切しない）。検知した相手が client_leads / sales_email_targets /
municipality_profiles のいずれかに登録済みなら scheduling_request_detected_at を更新する
（未登録の相手は通知にだけ出す。無理にレコード化しない）。

初回のみ、資格情報(agents/secrets/gmail_client_secret.json)を使って
ブラウザでの同意（会長の手動クリック）が必要。以降はトークンをキャッシュし
無人で自動更新するので、Windowsタスクスケジューラでの定期実行に使える。

セットアップ手順は agents/secrets/README.md を参照。
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from email.utils import parseaddr

import common

SECRETS_DIR = common.AGENTS_DIR / "secrets"
CLIENT_SECRET_PATH = SECRETS_DIR / "gmail_client_secret.json"
TOKEN_PATH = SECRETS_DIR / "gmail_token.json"

# 読み取り専用スコープ。送信・削除・ラベル変更の権限は持たせない。
# 受信箱全体を読める権限（gmail.readonly）自体はもともとこの1行のスコープに含まれている。
# 日程調整検知の対象を自治体宛だけから受信箱全体に広げても、Google側の新しい許可は不要
# （検索クエリを広げるだけ）。
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
OWN_ADDRESS = "hitomap.info@gmail.com"

# 「日程調整を求めている」と判定するキーワード（本文・件名のどちらかに含まれれば検知）。
# 誤検知が多ければここを調整する。
SCHEDULING_KEYWORDS = [
    "日程調整", "都合の良い", "都合のよい", "ご都合", "空いてる", "空いている",
    "空き状況", "面談", "打ち合わせ", "打合せ", "スケジュール調整", "お伺いできれば",
    "お時間いただけ", "アポイント", "アポを", "候補日",
]

# 直近何日分の受信メールを日程調整検知の対象にするか
SCAN_WINDOW_DAYS = 2
# 同じメールを2日連続で拾って通知が重複しないよう、通知済みメッセージIDを覚えておく
SEEN_SCHEDULING_IDS_PATH = common.WORK_DIR / "gmail_watch_scheduling_seen.json"
SEEN_SCHEDULING_IDS_MAX = 500


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


def _contains_scheduling_keyword(text: str) -> bool:
    return any(kw in text for kw in SCHEDULING_KEYWORDS)


def _scan_inbox_for_scheduling_requests(service) -> list[dict]:
    """受信箱全体（直近SCAN_WINDOW_DAYS日・自分が送ったものは除く）を見て、
    日程調整を求めていそうなメールを拾う。本文はここでの判定にしか使わず、
    マッチしなかったメールの内容はどこにも保存しない（既存の自治体巡回ロジックと同じ節度）。"""
    query = f"newer_than:{SCAN_WINDOW_DAYS}d -in:sent -in:chats"
    resp = service.users().messages().list(userId="me", q=query, maxResults=50).execute()
    message_ids = [m["id"] for m in resp.get("messages", [])]

    hits = []
    for mid in message_ids:
        msg = service.users().messages().get(userId="me", id=mid, format="full").execute()
        headers = msg.get("payload", {}).get("headers", [])
        sender_header = _header(headers, "From")
        sender_email = parseaddr(sender_header)[1].lower()
        if not sender_email or sender_email == OWN_ADDRESS.lower():
            continue
        sender_name = parseaddr(sender_header)[0] or sender_email
        subject = _header(headers, "Subject")
        body = _plain_text(msg.get("payload", {})) or msg.get("snippet", "")
        haystack = f"{subject}\n{body}"
        if not _contains_scheduling_keyword(haystack):
            continue
        preview = body.strip()[:150].replace("\n", " ")
        hits.append({
            "message_id": mid,
            "from_email": sender_email,
            "from_name": sender_name,
            "subject": subject,
            "preview": preview,
        })
    return hits


def _load_seen_scheduling_ids() -> set[str]:
    try:
        if SEEN_SCHEDULING_IDS_PATH.exists():
            return set(json.loads(SEEN_SCHEDULING_IDS_PATH.read_text(encoding="utf-8")))
    except Exception:
        pass
    return set()


def _save_seen_scheduling_ids(ids: set[str]) -> None:
    try:
        trimmed = list(ids)[-SEEN_SCHEDULING_IDS_MAX:]
        SEEN_SCHEDULING_IDS_PATH.write_text(json.dumps(trimmed, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def _compute_open_days(max_days: int = 5) -> list[str]:
    """calendar_watch.py（06:50に先に実行済み）が書いた空き情報から、
    平日で予定が少ない（0〜2件）日を「空いてそうな日」として拾う。
    真のfreebusy計算ではない簡易判定——公開予約サイト側（Part B）は
    Calendar freeBusy APIで正確に計算する別実装になる。"""
    from datetime import datetime

    result = common.read_result("calendar_watch")
    if not result or not result.get("connected"):
        return []

    weekday_labels = ["月", "火", "水", "木", "金", "土", "日"]
    open_days = []
    for day in result.get("days", []):
        date_str = day.get("date")
        if not date_str:
            continue
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            continue
        if d.weekday() >= 5:  # 土日は除外
            continue
        events = day.get("events") or []
        if len(events) <= 2:
            open_days.append(f"{d.month}/{d.day}({weekday_labels[d.weekday()]})")
        if len(open_days) >= max_days:
            break
    return open_days


def _supabase_get(env: dict, path: str) -> list[dict]:
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read())


# 検知したメールの送信者が、既存の3台帳（学校・法人 / 営業メール送り先 / 自治体プロファイル）の
# どれかに登録済みか調べる。見つかったテーブル・行だけ scheduling_request_detected_at を更新する。
_CONTACT_TABLES = [
    ("client_leads", "email", "org_name"),
    ("sales_email_targets", "email", "company"),
    ("municipality_profiles", "contact_email", "region_name"),
]


def _match_known_contact(env: dict, email: str) -> dict | None:
    encoded = urllib.parse.quote(email, safe="")
    for table, email_col, name_col in _CONTACT_TABLES:
        try:
            rows = _supabase_get(env, f"{table}?select=id,{name_col}&{email_col}=ilike.{encoded}")
        except Exception:
            continue
        if rows:
            return {"table": table, "id": rows[0]["id"], "name": rows[0].get(name_col) or email}
    return None


def _notify_scheduling_requests(env: dict, hits: list[dict], open_days: list[str]) -> str:
    webhook_url = env.get("HITOMAP_DISCORD_WEBHOOK_URL") or env.get("DISCORD_WEBHOOK_URL", "")
    if not webhook_url:
        return "未設定（.env.localにHITOMAP_DISCORD_WEBHOOK_URLを追加してください）"
    if not hits:
        return "日程調整の依頼なし（通知スキップ）"
    days_line = "・".join(open_days) if open_days else "（カレンダー未連携のため空き日を計算できません）"
    lines = [f"**📅 日程調整を求める返信が届いています（{len(hits)}件）**"]
    for h in hits:
        who = f"{h['from_name']}（{h['from_email']}）" if h["from_name"] != h["from_email"] else h["from_email"]
        matched = f" ・{h['matched_name']}として登録済み" if h.get("matched_name") else ""
        lines.append(f"・{who}{matched} — 「{h['subject'] or h['preview']}」")
    lines.append(f"空いてそうな日: {days_line}")
    lines.append("※簡易判定です。実際に返信する前にカレンダーで最終確認してください。")
    try:
        status = _send_discord_message(webhook_url, "\n".join(lines))
        return str(status)
    except Exception as e:
        return f"投稿エラー: {e}"


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

        # ---- 日程調整の検知（受信箱全体・学校/法人宛も含む） ----
        scheduling_requests: list[dict] = []
        scheduling_notify_result = "スキップ"
        try:
            raw_hits = _scan_inbox_for_scheduling_requests(service)
        except Exception as e:
            raw_hits = []
            scheduling_notify_result = f"検知エラー: {e}"

        if raw_hits:
            seen_ids = _load_seen_scheduling_ids()
            new_hits = [h for h in raw_hits if h["message_id"] not in seen_ids]

            for h in new_hits:
                match = _match_known_contact(env, h["from_email"])
                if match:
                    h["matched_table"] = match["table"]
                    h["matched_id"] = match["id"]
                    h["matched_name"] = match["name"]
                    try:
                        from datetime import datetime, timezone
                        _supabase_request(
                            env, "PATCH", f"{match['table']}?id=eq.{match['id']}",
                            {"scheduling_request_detected_at": datetime.now(timezone.utc).isoformat()},
                        )
                    except Exception:
                        pass  # マイグレーション未適用でも本処理は止めない

            open_days = _compute_open_days()
            for h in new_hits:
                h["candidate_open_days"] = open_days
            scheduling_requests = new_hits

            if new_hits:
                scheduling_notify_result = _notify_scheduling_requests(env, new_hits, open_days)
                seen_ids.update(h["message_id"] for h in new_hits)
                _save_seen_scheduling_ids(seen_ids)
            else:
                scheduling_notify_result = "新規なし（既に通知済み）"

        common.write_result("gmail_watch", {
            "connected": True,
            "checked": checked,
            "updated": updated,
            "new_replies": len(new_replies),
            "notify_result": notify_result,
            "scheduling_requests": scheduling_requests,
            "scheduling_notify_result": scheduling_notify_result,
            "errors": errors,
        })


if __name__ == "__main__":
    main()
