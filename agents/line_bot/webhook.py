"""LINE Webhook受信サーバー — グループの出来事を受け取り、会長に知らせる。
- 新メンバー参加（memberJoined）→ 会長に通知＋名簿追記の下書き
- 自己紹介っぽいメッセージ → 会長に通知（「新しい人が自己紹介しました」）

既定は「検知して会長に伝えるだけ」。自動返信は config.auto_welcome=true の時だけ。
LLM APIは使わない。署名検証あり。

起動: python webhook.py  （ローカル :8790 で待受）
LINEから届かせるには公開URL（cloudflare tunnel等）を webhook に設定する必要がある。READMEを参照。
"""
import base64
import hashlib
import hmac
import json
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LINE_DIR = Path(__file__).parent
CONFIG = LINE_DIR / "config.json"
LOG = LINE_DIR / "events_log.jsonl"
PORT = 8790
REPLY_URL = "https://api.line.me/v2/bot/message/reply"

# 自己紹介っぽさの手がかり
INTRO_HINTS = ["はじめまして", "初めまして", "自己紹介", "よろしくお願い", "入りました", "参加しました", "と申します"]


def load_env_local() -> dict:
    env = {}
    p = ROOT / ".env.local"
    if not p.exists():
        return env
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def load_config() -> dict:
    try:
        return json.loads(CONFIG.read_text(encoding="utf-8"))
    except Exception:
        return {}


def notify_discord(text: str):
    env = load_env_local()
    url = env.get("HITOMAP_DISCORD_WEBHOOK_URL") or env.get("DISCORD_WEBHOOK_URL")
    if not url:
        return
    try:
        body = json.dumps({"content": text}).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


def log_event(kind: str, detail: dict):
    rec = {"at": datetime.now().isoformat(), "kind": kind, **detail}
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def verify(body: bytes, signature: str, secret: str) -> bool:
    if not secret or not signature:
        return False
    mac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    return hmac.compare_digest(base64.b64encode(mac).decode("utf-8"), signature)


def reply(token: str, reply_token: str, text: str):
    body = json.dumps({"replyToken": reply_token, "messages": [{"type": "text", "text": text}]}).encode("utf-8")
    req = urllib.request.Request(
        REPLY_URL, data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}, method="POST")
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        # 疎通確認用
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"hitomap line webhook alive")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        env = load_env_local()
        config = load_config()
        secret = env.get("LINE_CHANNEL_SECRET", "")
        sig = self.headers.get("X-Line-Signature", "")
        # 署名検証（secretが設定されている場合のみ厳格に）
        if secret and not verify(body, sig, secret):
            self.send_response(403)
            self.end_headers()
            return
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            payload = {}
        token = env.get("LINE_CHANNEL_TOKEN", "")
        for ev in payload.get("events", []):
            self._handle(ev, token, config)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")

    def _handle(self, ev: dict, token: str, config: dict):
        etype = ev.get("type")
        if etype == "memberJoined":
            members = ev.get("joined", {}).get("members", [])
            log_event("memberJoined", {"count": len(members)})
            notify_discord(f"🎉 LINEグループに新しい人が {len(members)} 人参加しました。自己紹介が出たら、縁の設計のチャンスです。名簿(config.json)への追記をお願いします。")
            if config.get("auto_welcome") and token and ev.get("replyToken"):
                reply(token, ev["replyToken"], "はじめまして、ヒトマップです。よかったら、あなたの「今」と「好きなモノ」を一言だけ自己紹介してもらえませんか。")
        elif etype == "message" and ev.get("message", {}).get("type") == "text":
            text = ev["message"]["text"]
            if any(h in text for h in INTRO_HINTS):
                log_event("self_intro", {"text": text[:200]})
                notify_discord(f"🙋 LINEグループで自己紹介らしい投稿がありました:\n「{text[:120]}」\n→ この人を名簿に足して、縁ミッションの輪に入れましょう。")


if __name__ == "__main__":
    print(f"hitomap LINE webhook: http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
