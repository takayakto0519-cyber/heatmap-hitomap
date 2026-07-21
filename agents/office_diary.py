"""ビル日報AI（101）— 各番人の最新結果を読み、「昨日ビルで起きたこと」を数行の物語にする。
API不要・ローカルファイル読みのみ・ルールベース。毎朝1回のスケジュール実行を想定。
結果は work/office_diary.json に {lines: [...]} で保存し、ダッシュボードが表示する。
"""
from datetime import datetime

import common


def _read(agent_id: str) -> dict | None:
    return common.read_result(agent_id)


def main():
    with common.running("office_diary"):
        lines = []
        today = datetime.now().strftime("%Y-%m-%d (%a)")
        lines.append(f"☀ {today} のヒトマップ・オフィス日報")

        ap = _read("approval_watch")
        if ap:
            n = ap.get("stale_count", 0)
            lines.append(f"・送信待ちドラフトの見張り番：そのままの下書きは{n}件。" + ("急いで見てあげてください。" if n else "きれいに片付いています。"))

        cp = _read("case_pipeline_watch")
        if cp:
            total = cp.get("total", 0)
            stale = cp.get("stale_count", 0)
            if total:
                lines.append(f"・案件パイプライン番人：追いかけている案件は{total}件。" + (f"うち{stale}件が7日以上止まっています。" if stale else "どれも動いています。"))
            else:
                lines.append("・案件パイプライン番人：まだ案件はありません。最初の一件を作りましょう。")

        ri = _read("revenue_initiative_watch")
        if ri:
            active = ri.get("active_count", 0)
            stale = ri.get("stale_count", 0)
            lines.append(f"・収益化イニシアチブ番人：進行中の施策は{active}件。" + (f"{stale}件が2週間動いていません。" if stale else "止まっている施策はありません。"))

        rp = _read("report_screen")
        if rp:
            p = rp.get("pending_count", 0)
            if p:
                lines.append(f"・通報スクリーニング番人：未処理の通報が{p}件あります。")

        dl = _read("deadline_watch")
        if dl:
            u = dl.get("urgent_count", 0)
            if u:
                lines.append(f"・課題締切番人：3日以内の締切が{u}件。学業も大事に。")

        fs = _read("financial_snapshot")
        if fs:
            p = fs.get("product", {})
            if p:
                lines.append(f"・財務番人：痕跡投稿は累計{p.get('total_traces','?')}件（今週+{p.get('new_this_week','?')}）。")

        # XPトップを一言
        xp = common.read_result  # noqa
        try:
            import json
            xpf = common.WORK_DIR / "xp.json"
            if xpf.exists():
                data = json.loads(xpf.read_text(encoding="utf-8"))
                month = datetime.now().strftime("%Y-%m")
                best, bn = None, 0
                for aid, rec in data.items():
                    n = int((rec.get("monthly") or {}).get(month, 0))
                    if n > bn:
                        best, bn = aid, n
                if best:
                    lines.append(f"・今月いちばん働いているのは「{best}」（今月{bn}回）。ありがとう。")
        except Exception:
            pass

        if len(lines) == 1:
            lines.append("・まだ各番人の記録がありません。今日から少しずつ動き出します。")

        common.write_result("office_diary", {"lines": lines})


if __name__ == "__main__":
    main()
