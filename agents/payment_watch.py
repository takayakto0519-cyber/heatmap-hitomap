"""入金照合番人（6）— 案件カルテを読み、「請求」ステージに進んだのに入金確認がない案件を検知する。
API不要・ローカルファイルのみ・ルールベース。売掛の焦げ付き（請求したのに未入金）を防ぐ。
本文の「請求・入金」節に『入金』の記載があれば入金済みとみなす簡易判定。
"""
import common


def main():
    with common.running("payment_watch"):
        cards = common.read_case_cards()
        billed, unpaid = [], []
        for c in cards:
            stage = c["fields"].get("stage", "")
            org = c["fields"].get("org_name", c["file"])
            if stage in ("請求", "納品", "受注"):
                # 本文の請求・入金セクションに「入金」の文字があるかで簡易判定
                body = c["body"]
                paid = ("入金" in body and ("確認" in body or "済" in body))
                billed.append(org)
                if stage == "請求" and not paid:
                    unpaid.append({"org_name": org, "file": c["file"]})
        common.write_result("payment_watch", {
            "billed_count": len(billed),
            "unpaid_count": len(unpaid),
            "unpaid": unpaid,
        })


if __name__ == "__main__":
    main()
