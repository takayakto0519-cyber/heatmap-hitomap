"""営業メール下書きキュー番人（第1階梯の補助）— sales_email_targets テーブルを読み、
まだ下書きの無い相手の営業メール下書きを template.md から作って 06_実行待機_Approval に積む。

【重要】送信は絶対にしない。憲法と安全の原則により、AIは営業メールを自動送信しない。
このスキルは「会長が確認して送るだけ」の状態まで下書きを用意し続けるところまで。
LLM APIは使わない・テンプレート差し込みのみ・ルールベース。

以前は 営業メール/targets.json をローカルの真実の源としていたが、運営ダッシュボードの
営業タブは Supabase の sales_email_targets テーブルを見ており、二つの台帳が二重管理で
ずれ続けていた（ダッシュボードで追加した宛先がこの番人には見えない、逆も然り）。
DBを単一の真実の源にするため、sync_status_to_supabase.py と同じ「.env.localを読んで
PostgRESTへ素のHTTPで叩く」流儀でSupabaseを直接読み書きする。
"""
import json
import urllib.request
from datetime import datetime

import common

MAIL_DIR = common.ROOT / "営業メール"
TEMPLATE = MAIL_DIR / "template.md"
QUEUE_DIR = common.ROOT / "06_実行待機_Approval" / "営業メール下書き"


def _safe_name(s: str) -> str:
    return "".join(c for c in s if c.isalnum() or c in "　 ()（）ー-_").strip()[:40] or "宛先"


def _rest(env: dict, path: str, method: str = "GET", body: bytes | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(
        f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{path}",
        data=body,
        headers={
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.status, res.read()


def main():
    with common.running("email_queue"):
        env = common.load_env_local()
        if not env.get("NEXT_PUBLIC_SUPABASE_URL") or not env.get("SUPABASE_SERVICE_ROLE_KEY"):
            common.write_result("email_queue", {"error": "SUPABASE_SERVICE_ROLE_KEY(.env.local)が見つかりません"})
            return
        if not TEMPLATE.exists():
            common.write_result("email_queue", {"error": "template.md が見つかりません"})
            return
        template = TEMPLATE.read_text(encoding="utf-8")

        try:
            status, raw = _rest(env, "sales_email_targets?select=id,company,email,hook,drafted,sent&sent=eq.false")
            targets = json.loads(raw) if status == 200 else []
        except Exception as e:
            common.write_result("email_queue", {"error": f"sales_email_targets 取得失敗: {e}"})
            return

        QUEUE_DIR.mkdir(parents=True, exist_ok=True)
        drafted_now = []
        today = datetime.now().strftime("%Y%m%d")

        for t in targets:
            company = str(t.get("company", "")).strip()
            if not company or t.get("drafted"):
                continue
            body = template.replace("{{company}}", company).replace("{{hook}}", t.get("hook") or "")
            path = QUEUE_DIR / f"営業メール_{_safe_name(company)}_{today}.md"
            to = t.get("email") or "（宛先メール未記入 — 会長が補完）"
            path.write_text(f"# 営業メール下書き（{company}）\n\n宛先: {to}\n状態: 未送信（会長が確認して送信）\n\n---\n{body}\n---\n", encoding="utf-8")
            try:
                _rest(env, f"sales_email_targets?id=eq.{t['id']}", method="PATCH", body=json.dumps({"drafted": True}).encode("utf-8"))
                drafted_now.append(company)
            except Exception:
                pass  # 下書きファイルは残るので、DB更新だけ次回リトライされる

        common.write_result("email_queue", {
            "target_count": len(targets),
            "drafted_now": drafted_now,
            "pending_send": len(targets),
            "note": "下書きを 06_実行待機_Approval/営業メール下書き に用意しました。送信は会長が手動で。宛先はSupabase(sales_email_targets)から取得しています。",
        })


if __name__ == "__main__":
    main()
