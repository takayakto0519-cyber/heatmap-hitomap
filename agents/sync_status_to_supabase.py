"""稼働状況の同期AI — ローカルで動いているエージェント（agents/*.py）の最新結果を
Supabaseのagent_status_snapshotテーブルへ書き込む。
hitomap.com（本番・Vercel等）はこのPCのローカルファイルに直接アクセスできないため、
運営ダッシュボードの「稼働状況」タブは本番からアクセスされた場合、このテーブルを読む。
LLM APIは使わない。1時間おきに実行し、常に「最終同期」時点のスナップショットを保つ。

フロア・エージェント一覧はagent-dashboard/server.pyが一次情報源。
あちらに新しい番人を追加したら、app/api/admin/agent-status/route.tsのLOCAL_AGENTSと
このAGENTSリストの両方に同じ内容を追記すること。
"""
import json
import urllib.request
from datetime import datetime, timezone

import common

AGENTS = [
    {"id": "approval_watch", "name": "3. 06番地滞留監視", "emoji": "🐹", "floor": "A", "schedule": "毎日 08:00"},
    {"id": "report_screen", "name": "19. 通報一次スクリーニングAI", "emoji": "🦫", "floor": "D", "schedule": "毎日 07:30"},
    {"id": "trace_qa", "name": "22. データ整合性夜間QA番人", "emoji": "🦔", "floor": "D", "schedule": "毎日 02:00"},
    {"id": "deadline_watch", "name": "54. 課題締切トラッキングAI", "emoji": "🐰", "floor": "K", "schedule": "毎日 07:00"},
    {"id": "spam_detect", "name": "23. 不正投稿検知AI", "emoji": "🐝", "floor": "D", "schedule": "毎日 03:00"},
    {"id": "news_digest", "name": "60. 今日のニュース抽出AI", "emoji": "🐦", "floor": "B", "schedule": "8時間ごと（06:30起点）"},
    {"id": "financial_snapshot", "name": "42. 財務・事業ダッシュボードAI要約", "emoji": "🐷", "floor": "H", "schedule": "毎日 07:45"},
    {"id": "case_pipeline_watch", "name": "8. 案件パイプライン番人", "emoji": "🐿️", "floor": "B", "schedule": "毎日 08:15"},
    {"id": "revenue_initiative_watch", "name": "収益化イニシアチブ番人", "emoji": "🐸", "floor": "J", "schedule": "毎日 08:30"},
    {"id": "office_diary", "name": "101. ビル日報AI", "emoji": "🐤", "floor": "A", "schedule": "毎日 09:15"},
    {"id": "lead_temperature", "name": "4. リード温度感スコアリングAI", "emoji": "🐧", "floor": "B", "schedule": "毎日 08:45"},
    {"id": "payment_watch", "name": "6. 入金照合番人", "emoji": "🐮", "floor": "H", "schedule": "毎日 08:50"},
    {"id": "lost_deal_archive", "name": "10. 失注理由アーカイブAI", "emoji": "🐋", "floor": "B", "schedule": "毎週月 09:00"},
    {"id": "schedule_watch", "name": "25. スケジュール番人", "emoji": "🐈", "floor": "A", "schedule": "毎日 07:15"},
    {"id": "burnout_watch", "name": "27. 燃え尽き検知番人", "emoji": "🐨", "floor": "A", "schedule": "毎日 21:00"},
    {"id": "line_mission", "name": "LINE縁ミッション生成", "emoji": "🐇", "floor": "E", "schedule": "毎日確認（2週に一度発火）"},
    {"id": "email_queue", "name": "営業メール下書きキュー", "emoji": "🐢", "floor": "B", "schedule": "毎日 08:35"},
    {"id": "trace_pattern", "name": "62. 痕跡データパターン分析AI", "emoji": "🦩", "floor": "I", "schedule": "毎日 02:30"},
    {"id": "relation_population", "name": "63. 関係人口ダッシュボードAI", "emoji": "🦚", "floor": "G", "schedule": "毎日 02:40"},
    {"id": "calendar_watch", "name": "29. カレンダー番人", "emoji": "🦉", "floor": "A", "schedule": "毎日 06:50"},
    {"id": "competitor_market_research", "name": "9. 競合・市場調査エージェント", "emoji": "🦫", "floor": "B", "schedule": "毎日 06:00"},
    {"id": "marketing_digest", "name": "マーケティング日報", "emoji": "🦔", "floor": "B", "schedule": "毎日 08:40"},
    {"id": "competitor_feature_monitor", "name": "42. 競合プロダクト機能差分モニタAI", "emoji": "🦎", "floor": "I", "schedule": "毎日 06:10"},
    {"id": "ab_test_summary_watch", "name": "79. UI改善A/Bテスト自動集計AI", "emoji": "🐁", "floor": "I", "schedule": "毎日 03:10"},
    {"id": "command_center", "name": "80. 統合司令室AI", "emoji": "🦅", "floor": "I", "schedule": "毎日 09:30"},
    {"id": "new_biz_signal_watch", "name": "50. 新規事業仮説の種探しAI", "emoji": "🐣", "floor": "J", "schedule": "毎日 05:40"},
    {"id": "global_market_watch", "name": "51. 海外展開リサーチAI", "emoji": "🦜", "floor": "J", "schedule": "毎日 06:20"},
    {"id": "academic_partnership_watch", "name": "52. 産学連携リサーチAI", "emoji": "🦉", "floor": "J", "schedule": "毎日 06:30"},
    {"id": "memorial_anniversary_watch", "name": "53. 周年史アーカイブAI", "emoji": "🕊️", "floor": "J", "schedule": "毎日 07:05"},
]


def _xp_to_level(total: int) -> tuple[int, int]:
    return 1 + total // 5, total


def main():
    with common.running("sync_status_to_supabase"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            common.write_result("sync_status_to_supabase", {"error": "SUPABASE_SERVICE_ROLE_KEY(.env.local)が見つかりません"})
            return

        xp_data = common.read_result("xp") or {}
        # xp.jsonはwrite_result形式ではないため個別に読む
        xp_path = common.WORK_DIR / "xp.json"
        if xp_path.exists():
            try:
                xp_data = json.loads(xp_path.read_text(encoding="utf-8"))
            except Exception:
                xp_data = {}

        rows = []
        for meta in AGENTS:
            result = common.read_result(meta["id"])
            xp_rec = xp_data.get(meta["id"], {})
            level, xp = _xp_to_level(int(xp_rec.get("total", 0)))
            rows.append({
                "agent_id": meta["id"], "name": meta["name"], "emoji": meta["emoji"],
                "floor": meta["floor"], "schedule": meta["schedule"],
                "result": result, "generated_at": (result or {}).get("generated_at"),
                "level": level, "xp": xp, "synced_at": datetime.now(timezone.utc).isoformat(),
            })

        req = urllib.request.Request(
            f"{url}/rest/v1/agent_status_snapshot?on_conflict=agent_id",
            data=json.dumps(rows, ensure_ascii=False).encode("utf-8"),
            headers={
                "apikey": key, "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                status = res.status
        except Exception as e:
            common.write_result("sync_status_to_supabase", {"error": f"同期エラー: {e}", "row_count": len(rows)})
            return

        common.write_result("sync_status_to_supabase", {"synced_count": len(rows), "http_status": status})


if __name__ == "__main__":
    main()
