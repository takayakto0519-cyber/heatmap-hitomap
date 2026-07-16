"""「その後」通知エージェント — 縁の定着を促す。

「もう一度来たい」（want_revisit）で記録された痕跡のうち、投稿から一定日数が経っても
本人がまだ「その後」を記録していないものに、一度だけアプリ内通知を送る
（notifications テーブルへの INSERT のみ。メール・Discord・外部送信は一切行わない）。

通知は既存の「🔁 その後を記録する」導線（components/TraceDetail.tsx）と地図画面の
通知ベル（app/map/page.tsx）にそのまま乗る想定で、新しいUIは追加しない。

--dry-run を付けると、対象を洗い出すだけで実際のINSERTは行わない（初回確認用）。
"""
import argparse
import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import common

REVISIT_AFTER_DAYS = 30  # この日数を過ぎても「その後」が記録されていない痕跡を対象にする


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read())


def _post(url: str, key: str, path: str, body: dict) -> None:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    with urllib.request.urlopen(req, timeout=10):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="対象を洗い出すだけで通知は作成しない")
    args = parser.parse_args()

    with common.running("revisit_prompt"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        # 通知の作成はRLSを越える書き込みのため、service_role必須（anonキーへのフォールバックはしない）
        key = env.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            common.write_result("revisit_prompt", {"error": "SUPABASE_SERVICE_ROLE_KEY(.env.local)が見つかりません"})
            return

        cutoff = (datetime.now(timezone.utc) - timedelta(days=REVISIT_AFTER_DAYS)).isoformat()
        cutoff_q = urllib.parse.quote(cutoff, safe="")  # '+'や':'がURLクエリで壊れないようエンコードする

        try:
            candidates = _get(
                url, key,
                "traces?select=id,title,user_id,created_at"
                "&want_revisit=eq.true&is_deleted=eq.false&user_id=not.is.null"
                f"&created_at=lt.{cutoff_q}&order=created_at.asc&limit=200",
            )
        except Exception as e:
            common.write_result("revisit_prompt", {"error": f"Supabase取得エラー: {e}"})
            return

        created = []
        skipped_already_revisited = 0
        skipped_already_notified = 0

        for t in candidates:
            trace_id = t["id"]

            # 本人がすでに「その後」を記録済みなら対象外
            try:
                already_revisited = _get(
                    url, key, f"traces?revisit_of=eq.{trace_id}&select=id&limit=1"
                )
            except Exception:
                already_revisited = []
            if already_revisited:
                skipped_already_revisited += 1
                continue

            # 過去に一度でも通知済みなら再送しない（毎回のスパム化を防ぐ）
            try:
                already_notified = _get(
                    url, key,
                    f"notifications?trace_id=eq.{trace_id}&type=eq.revisit_prompt&select=id&limit=1",
                )
            except Exception:
                already_notified = []
            if already_notified:
                skipped_already_notified += 1
                continue

            title = (t.get("title") or "").strip() or "その痕跡"
            message = f"「{title}」は、その後どうなりましたか？"

            if not args.dry_run:
                try:
                    _post(url, key, "notifications", {
                        "user_id": t["user_id"],
                        "type": "revisit_prompt",
                        "trace_id": trace_id,
                        "message": message,
                    })
                except Exception as e:
                    common.write_result("revisit_prompt", {"error": f"通知作成エラー(trace_id={trace_id}): {e}"})
                    return

            created.append({"trace_id": trace_id, "title": title, "user_id": t["user_id"]})

        common.write_result("revisit_prompt", {
            "dry_run": args.dry_run,
            "cutoff_days": REVISIT_AFTER_DAYS,
            "candidates_checked": len(candidates),
            "notifications_created": len(created),
            "skipped_already_revisited": skipped_already_revisited,
            "skipped_already_notified": skipped_already_notified,
            "created": created,
        })


if __name__ == "__main__":
    main()
