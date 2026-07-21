"""送信待ちドラフトの監視エージェント — 06_実行待機_Approval フォルダに置いたまま
動いていない下書き（会長が確認して外部送信するもの）を検知する。
毎日1回のスケジュール実行を想定（register_tasks.ps1で登録）。API不要・ローカルファイル監視のみ。
"""
from datetime import datetime
from pathlib import Path

import common

APPROVAL_DIR = Path(
    r"C:\Users\takaya\OneDrive - 東京農業大学\デスクトップ\ヒトマップ事業_書類\06_実行待機_Approval"
)
STALE_DAYS = 3


def main():
    with common.running("approval_watch"):
        all_files, stale = [], []
        if APPROVAL_DIR.exists():
            for f in APPROVAL_DIR.rglob("*"):
                if not f.is_file() or f.name == "README.md" or f.name.startswith("~$"):
                    continue
                age_days = (datetime.now().timestamp() - f.stat().st_mtime) / 86400
                entry = {"path": str(f.relative_to(APPROVAL_DIR)), "age_days": round(age_days, 1)}
                all_files.append(entry)
                if age_days >= STALE_DAYS:
                    stale.append(entry)
        common.write_result("approval_watch", {
            "dir_exists": APPROVAL_DIR.exists(),
            "total": len(all_files),
            "stale_count": len(stale),
            "stale": sorted(stale, key=lambda e: -e["age_days"]),
        })


if __name__ == "__main__":
    main()
