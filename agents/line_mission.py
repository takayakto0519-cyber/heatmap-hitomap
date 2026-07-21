"""LINE縁ミッション生成番人 — 2週に一度、名簿から2人を選び「この人と話してみて」の縁ミッションを作る。
ヒトマップの思想（縁＝出会い＋共に取り組む行動×推譲）をLINEグループの装置にする。

既定は「下書きモード」：ミッション文を 06_実行待機_Approval に置き、会長が送る。
config.json の auto_push を true にした時だけ、LINEグループへ自動push（会長の明示的な設定＝承認とみなす）。
LLM APIは使わない・ルールベース。
"""
import json
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

import common

LINE_DIR = common.ROOT / "agents" / "line_bot"
CONFIG = LINE_DIR / "config.json"
STATE = common.WORK_DIR / "line_mission_state.json"
APPROVAL_DIR = common.ROOT / "06_実行待機_Approval"
PUSH_URL = "https://api.line.me/v2/bot/message/push"


def _load_json(p: Path, default):
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default
    except Exception:
        return default


def _pick_pair(members: list, cursor: int):
    real = [m for m in members if not str(m.get("name", "")).startswith("（例）")]
    if len(real) < 2:
        return None, cursor
    real.sort(key=lambda m: m.get("name", ""))
    i = cursor % len(real)
    j = (cursor + 1) % len(real)
    if i == j:
        j = (j + 1) % len(real)
    return (real[i], real[j]), cursor + 1


def _mission_text(a: dict, b: dict) -> str:
    an, bn = a.get("name", ""), b.get("name", "")
    lines = [
        "【今週の縁ミッション】",
        f"{an} さん、{bn} さん。よかったら一度、話してみませんか。",
    ]
    if a.get("note"):
        lines.append(f"・{an}：{a['note']}")
    if b.get("note"):
        lines.append(f"・{bn}：{b['note']}")
    lines.append("")
    lines.append("縁は、出会いに“共に取り組む行動”が重なって生まれます。まずは一言、声をかけてみるところから。")
    lines.append("（このミッションは2週に一度、ヒトマップから届きます）")
    return "\n".join(lines)


def _push_to_line(token: str, group_id: str, text: str) -> str:
    body = json.dumps({"to": group_id, "messages": [{"type": "text", "text": text}]}).encode("utf-8")
    req = urllib.request.Request(
        PUSH_URL, data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return f"pushed({res.status})"


def main():
    with common.running("line_mission"):
        config = _load_json(CONFIG, {})
        members = config.get("members", [])
        state = _load_json(STATE, {"cursor": 0, "last_run": None})

        # 実行間隔ガード：前回から interval_days 経っていなければ何もしない（週次スケジュールでも2週に一度だけ動く）
        interval = int(config.get("mission_interval_days", 14))
        last = state.get("last_run")
        if last:
            try:
                elapsed = (datetime.now() - datetime.fromisoformat(last)).days
                if elapsed < interval:
                    common.write_result("line_mission", {
                        "status": f"前回から{elapsed}日。あと{interval - elapsed}日で次の縁ミッション。",
                        "skipped": True,
                    })
                    return
            except ValueError:
                pass

        pair, new_cursor = _pick_pair(members, state.get("cursor", 0))
        if pair is None:
            common.write_result("line_mission", {
                "status": "名簿が足りません（実在メンバーを2人以上、config.jsonに登録してください）",
                "member_count": len(members),
            })
            return

        text = _mission_text(pair[0], pair[1])
        today = datetime.now().strftime("%Y%m%d")

        # 常に下書きを 06_実行待機_Approval に保存（記録と、auto_pushでない時の会長送信用）
        APPROVAL_DIR.mkdir(parents=True, exist_ok=True)
        draft_path = APPROVAL_DIR / f"LINE縁ミッション_{today}.md"
        draft_path.write_text(f"# LINE縁ミッション下書き（{today}）\n\n以下をLINEグループに投稿:\n\n---\n{text}\n---\n", encoding="utf-8")

        pushed = "下書きのみ（auto_push=false）。06_実行待機_Approval に保存しました。会長が送ってください。"
        if config.get("auto_push"):
            env = common.load_env_local()
            token = env.get("LINE_CHANNEL_TOKEN")
            gid = config.get("group_id")
            if token and gid:
                try:
                    pushed = _push_to_line(token, gid, text)
                except Exception as e:
                    pushed = f"push失敗: {e}（下書きは 06_実行待機_Approval に残しています）"
            else:
                pushed = "auto_pushはtrueですが、LINE_CHANNEL_TOKEN か group_id が未設定です。下書きのみ。"

        state["cursor"] = new_cursor
        state["last_run"] = datetime.now().isoformat()
        STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

        common.write_result("line_mission", {
            "status": "生成しました",
            "pair": [pair[0].get("name"), pair[1].get("name")],
            "pushed": pushed,
            "next_interval_days": config.get("mission_interval_days", 14),
        })


if __name__ == "__main__":
    main()
