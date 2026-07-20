"""作業状況ダッシュボード番人 — Supabaseのaction_itemsテーブルを読み、
「会長作業待ち」「未着手」のタスクだけを1日1回Discordへ報告する。
完了済み(done)・保留(blocked)は報告しない（会長が今日動かすべきものだけに絞る）。
LLM APIは使わない（固定ルールで整形するだけ）。API不要のSupabase REST読み取りのみ。
"""
import json
import urllib.request

import common

# 表示優先順：会長作業待ちを最初に（今すぐ会長が動ける物を先頭に出す）
STATUS_ORDER = ["manual_required", "todo"]
STATUS_LABEL = {"manual_required": "🟠 会長作業待ち", "todo": "⚪ 未着手"}
STATUS_COLOR = {"manual_required": 0xE67E22, "todo": 0x999999}


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read())


def _send_discord_message(webhook_url: str, content: str, embeds: list[dict]) -> int:
    payload = {"username": "ヒトマップ 作業状況番人", "content": content, "embeds": embeds}
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "HitomapActionItemsDigest/1.0 (+https://github.com/hitomap)",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return res.status


def _embed_for_status(status: str, items: list[dict]) -> dict | None:
    if not items:
        return None
    lines = []
    for i in items[:15]:
        title = i.get("title") or "(無題)"
        cat = i.get("category") or "その他"
        ref = i.get("file_ref")
        line = f"・**{title}**（{cat}）"
        if ref:
            line += f"\n  📎 `{ref}`"
        if i.get("notes"):
            line += f"\n  {i['notes']}"
        lines.append(line)
    return {
        "title": f"{STATUS_LABEL[status]}（{len(items)}件）",
        "description": "\n".join(lines)[:4000],
        "color": STATUS_COLOR[status],
    }


def main():
    with common.running("action_items_digest"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("action_items_digest", {"error": "Supabase設定(.env.local)が見つかりません"})
            return

        try:
            items = _get(url, key, "action_items?select=title,category,status,owner,file_ref,notes&order=updated_at.desc&limit=200")
        except Exception as e:
            common.write_result("action_items_digest", {"error": f"取得エラー: {e}"})
            return

        by_status = {s: [i for i in items if i.get("status") == s] for s in STATUS_ORDER}
        embeds = [e for s in STATUS_ORDER if (e := _embed_for_status(s, by_status[s]))]

        webhook_url = env.get("HITOMAP_DISCORD_WEBHOOK_URL") or env.get("DISCORD_WEBHOOK_URL", "")
        pending_total = sum(len(v) for v in by_status.values())
        if not webhook_url:
            post_result = "未設定（.env.localにHITOMAP_DISCORD_WEBHOOK_URLを追加してください）"
        elif not embeds:
            post_result = "報告できる未完了タスクなし（投稿スキップ）"
        else:
            title = f"**📋 作業状況デイリー報告**（未完了 {pending_total}件）"
            try:
                status_code = _send_discord_message(webhook_url, title, embeds)
                post_result = str(status_code)
            except Exception as e:
                post_result = f"投稿エラー: {e}"

        common.write_result("action_items_digest", {
            "total": len(items),
            "pending_total": pending_total,
            "manual_required_count": len(by_status["manual_required"]),
            "todo_count": len(by_status["todo"]),
            "post_result": post_result,
        })


if __name__ == "__main__":
    main()
