"""営業メール下書きキュー番人（第1階梯の補助）— targets.json を読み、まだ下書きの無い相手の
営業メール下書きを template.md から作って 06_実行待機_Approval に積む。

【重要】送信は絶対にしない。憲法と安全の原則により、AIは営業メールを自動送信しない。
このスキルは「会長が確認して送るだけ」の状態まで下書きを用意し続けるところまで。
LLM APIは使わない・テンプレート差し込みのみ・ルールベース。
"""
import json
from datetime import datetime

import common

MAIL_DIR = common.ROOT / "営業メール"
TARGETS = MAIL_DIR / "targets.json"
TEMPLATE = MAIL_DIR / "template.md"
QUEUE_DIR = common.ROOT / "06_実行待機_Approval" / "営業メール下書き"


def _safe_name(s: str) -> str:
    return "".join(c for c in s if c.isalnum() or c in "　 ()（）ー-_").strip()[:40] or "宛先"


def main():
    with common.running("email_queue"):
        if not TARGETS.exists() or not TEMPLATE.exists():
            common.write_result("email_queue", {"error": "targets.json か template.md が見つかりません"})
            return
        try:
            data = json.loads(TARGETS.read_text(encoding="utf-8"))
        except Exception as e:
            common.write_result("email_queue", {"error": f"targets.json 読み込み失敗: {e}"})
            return
        template = TEMPLATE.read_text(encoding="utf-8")
        targets = data.get("targets", [])

        QUEUE_DIR.mkdir(parents=True, exist_ok=True)
        drafted_now, pending_send = [], 0
        changed = False
        today = datetime.now().strftime("%Y%m%d")

        for t in targets:
            company = str(t.get("company", "")).strip()
            if not company or company.startswith("（例）"):
                continue
            if t.get("sent"):
                continue
            if not t.get("drafted"):
                # 下書き生成（テンプレート差し込み）
                body = template.replace("{{company}}", company).replace("{{hook}}", t.get("hook", ""))
                path = QUEUE_DIR / f"営業メール_{_safe_name(company)}_{today}.md"
                to = t.get("email") or "（宛先メール未記入 — 会長が補完）"
                path.write_text(f"# 営業メール下書き（{company}）\n\n宛先: {to}\n状態: 未送信（会長が確認して送信）\n\n---\n{body}\n---\n", encoding="utf-8")
                t["drafted"] = True
                changed = True
                drafted_now.append(company)
            pending_send += 1

        if changed:
            TARGETS.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

        common.write_result("email_queue", {
            "target_count": len([t for t in targets if not str(t.get("company", "")).startswith("（例）")]),
            "drafted_now": drafted_now,
            "pending_send": pending_send,
            "note": "下書きを 06_実行待機_Approval/営業メール下書き に用意しました。送信は会長が手動で。",
        })


if __name__ == "__main__":
    main()
