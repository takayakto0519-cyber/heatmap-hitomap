"""統合司令室AI（46/80・9F データ・分析R&D）— 全番人の最新結果を読み、
「今すぐ会長の判断が要ること」だけをフロア別に1枚へ抽出する。
office_diary.py（毎朝の物語）とは役割が違う：あちらは昨日の出来事を語り、
こちらは「今、注意が必要な項目」だけを構造化して並べる読み取り専用の管制盤。
LLM APIは使わずローカルのwork/*.json読み取りのみ。結果はwork/command_center.jsonに保存し、
agent-dashboard（ヒトマップビル）と運営ダッシュボードが表示する。Discordには投稿しない
（marketing_digest.py等、投稿すべき場所は別に決まっているため二重通知を避ける）。
"""
import common

# フロア名はagent-dashboard/server.pyのFLOORS定義が一次情報源。ここは表示用の簡易コピー。
FLOOR_NAMES = {
    "A": "組織運営・秘書", "B": "マーケティング・営業", "C": "コンテンツ・広報",
    "D": "プロダクト運用", "E": "コミュニティ運営", "F": "HR・採用インターン",
    "G": "自治体・観光(B2G)", "H": "財務・投資", "I": "データ・分析R&D",
    "J": "新規事業探索", "K": "学生課題支援",
}

# agent_id -> (フロア, 表示名, 注意判定に使うフィールド名 or None)
# urgent_fieldの値が0より大きければ「注意」とみなす。Noneは常時「正常」扱い（個別ロジックは_is_urgentで例外対応）。
AGENT_META: dict[str, tuple[str, str, str | None]] = {
    "approval_watch": ("A", "06番地滞留監視", "stale_count"),
    "report_screen": ("D", "通報一次スクリーニング", "pending_count"),
    "trace_qa": ("D", "データ整合性QA", "issue_count"),
    "deadline_watch": ("K", "課題締切トラッキング", "urgent_count"),
    "spam_detect": ("D", "不正投稿検知", "duplicate_title_count"),
    "news_digest": ("B", "ニュース抽出", None),
    "financial_snapshot": ("H", "財務・事業ダッシュボード要約", None),
    "case_pipeline_watch": ("B", "案件パイプライン", "stale_count"),
    "revenue_initiative_watch": ("J", "収益化イニシアチブ", "stale_count"),
    "office_diary": ("A", "ビル日報", None),
    "lead_temperature": ("B", "リード温度感スコアリング", None),
    "payment_watch": ("H", "入金照合", "unpaid_count"),
    "lost_deal_archive": ("B", "失注理由アーカイブ", None),
    "schedule_watch": ("A", "スケジュール", None),
    "burnout_watch": ("A", "燃え尽き検知", None),  # warningsリストで例外判定
    "line_mission": ("E", "LINE縁ミッション", None),
    "email_queue": ("B", "営業メール下書きキュー", None),
    "trace_pattern": ("I", "痕跡データパターン分析", None),
    "relation_population": ("G", "関係人口ダッシュボード", None),
    "calendar_watch": ("A", "カレンダー", None),
    "competitor_market_research": ("B", "競合・市場調査", None),
    "marketing_digest": ("B", "マーケティング日報", None),
    "ab_test_summary_watch": ("I", "UI改善A/Bテスト自動集計", None),
    "competitor_feature_monitor": ("I", "競合プロダクト機能差分モニタ", "update_count"),
}


def _headline(agent_id: str, result: dict | None, urgent_field: str | None) -> tuple[str, bool]:
    if result is None:
        return "実行履歴なし", False
    if result.get("error"):
        return f"⚠️ {result['error']}", True
    if agent_id == "burnout_watch":
        warnings = result.get("warnings") or []
        return (warnings[0], True) if warnings else ("健全", False)
    if urgent_field:
        value = result.get(urgent_field)
        if isinstance(value, (int, float)) and value > 0:
            return f"{urgent_field}={value}", True
    return "正常", False


def main():
    with common.running("command_center"):
        attention_items = []
        floors: dict[str, dict] = {}

        for agent_id, (floor, name, urgent_field) in AGENT_META.items():
            result = common.read_result(agent_id)
            headline, urgent = _headline(agent_id, result, urgent_field)
            bucket = floors.setdefault(floor, {"floor_id": floor, "floor_name": FLOOR_NAMES.get(floor, floor), "ok_count": 0, "attention": []})
            if urgent:
                item = {"agent_id": agent_id, "floor": floor, "name": name, "headline": headline}
                bucket["attention"].append(item)
                attention_items.append(item)
            else:
                bucket["ok_count"] += 1

        floors_list = sorted(floors.values(), key=lambda f: f["floor_id"])
        common.write_result("command_center", {
            "total_agents_tracked": len(AGENT_META),
            "attention_count": len(attention_items),
            "attention_items": attention_items,
            "floors": floors_list,
        })


if __name__ == "__main__":
    main()
