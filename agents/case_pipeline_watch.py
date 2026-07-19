"""案件パイプライン番人 — 04_人事クライアント管理_HR_Client/案件 の案件カルテを走査し、
ステージ別件数と7日以上更新のない停滞案件を検知する。
毎日1回のスケジュール実行を想定（register_tasks.pyで登録）。API不要・ローカルファイル解析のみ。
"""
import re
from datetime import datetime
from pathlib import Path

import common

CASE_DIR = common.ROOT / "04_人事クライアント管理_HR_Client" / "案件"
STALE_DAYS = 7

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
FIELD_RE = re.compile(r'^(\w+):\s*"?(.*?)"?\s*$')


def _parse_frontmatter(text: str) -> dict:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    fields = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.startswith(" ") or line.startswith("-"):
            continue
        fm = FIELD_RE.match(line)
        if fm:
            fields[fm.group(1)] = fm.group(2).strip()
    return fields


def main():
    with common.running("case_pipeline_watch"):
        cases = []
        if CASE_DIR.exists():
            for f in sorted(CASE_DIR.glob("*.md")):
                if f.name == "_テンプレート.md":
                    continue
                fields = _parse_frontmatter(f.read_text(encoding="utf-8"))
                org_name = fields.get("org_name", f.stem)
                stage = fields.get("stage", "不明")
                updated_str = fields.get("updated", "")
                age_days = None
                try:
                    updated_date = datetime.strptime(updated_str, "%Y-%m-%d")
                    age_days = round((datetime.now() - updated_date).total_seconds() / 86400, 1)
                except ValueError:
                    pass
                cases.append({
                    "file": f.name,
                    "org_name": org_name,
                    "stage": stage,
                    "updated": updated_str or None,
                    "age_days": age_days,
                    "next_action": fields.get("next_action", ""),
                })

        by_stage = {}
        for c in cases:
            by_stage.setdefault(c["stage"], []).append(c["org_name"])

        stale = [c for c in cases if c["age_days"] is not None and c["age_days"] >= STALE_DAYS]

        common.write_result("case_pipeline_watch", {
            "dir_exists": CASE_DIR.exists(),
            "total": len(cases),
            "by_stage": {stage: len(names) for stage, names in by_stage.items()},
            "by_stage_detail": by_stage,
            "stale_count": len(stale),
            "stale": sorted(stale, key=lambda c: -(c["age_days"] or 0)),
        })


if __name__ == "__main__":
    main()
