"""失注理由アーカイブAI（10）— 案件カルテで stage=見送り の案件を集め、失注の記録を棚卸しする。
API不要・ローカルファイルのみ・ルールベース。「なぜ負けたか」を貯めて提案の型を進化させる燃料にする。
"""
import common


def main():
    with common.running("lost_deal_archive"):
        cards = common.read_case_cards()
        lost = []
        for c in cards:
            stage = c["fields"].get("stage", "")
            if stage in ("見送り", "失注"):
                lost.append({
                    "org_name": c["fields"].get("org_name", c["file"]),
                    "file": c["file"],
                    # 本文から「失注」「見送り」を含む行を1つ拾って理由の手がかりに
                    "hint": next((ln.strip() for ln in c["body"].splitlines()
                                  if ("見送" in ln or "失注" in ln or "理由" in ln) and len(ln.strip()) > 4), ""),
                })
        common.write_result("lost_deal_archive", {
            "lost_count": len(lost),
            "lost": lost,
        })


if __name__ == "__main__":
    main()
