"""
エージェント稼働状況ダッシュボード「ヒトマップビル」 — ローカルAPIサーバー
python server.py で起動し、http://127.0.0.1:8765 を開く。
"""
import json
import subprocess
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8765
DASHBOARD_DIR = Path(__file__).parent

# moomooは別リポジトリ（同一PC上）で稼働しているため絶対パス参照
MOOMOO_ROOT = Path(r"C:\Users\takaya\Documents\Codex\2026-06-01\moomoo-api-ai-1-ai-web")
MOOMOO_WORK = MOOMOO_ROOT / "work"

AFFILIATE_DIR = DASHBOARD_DIR.parent / "affiliate-auto"
AFFILIATE_FLAG = AFFILIATE_DIR / "work" / "running.flag"
AFFILIATE_RESULTS = AFFILIATE_DIR / "results.json"

# 2026-07-09実装。ローカルで完結する読み取り専用エージェント（agents/*.py、Windowsタスクスケジューラ登録済み）。
LOCAL_AGENTS_DIR = DASHBOARD_DIR.parent / "agents"
LOCAL_AGENTS_WORK = LOCAL_AGENTS_DIR / "work"
LOCAL_AGENTS = [
    {"id": "approval_watch", "name": "3. 06番地滞留監視",       "emoji": "🗂️", "floor": "A", "schedule": "毎日 08:00"},
    {"id": "report_screen",  "name": "19. 通報一次スクリーニングAI", "emoji": "🛠️", "floor": "D", "schedule": "毎日 07:30"},
    {"id": "trace_qa",       "name": "22. データ整合性夜間QA番人", "emoji": "🛠️", "floor": "D", "schedule": "毎日 02:00"},
    {"id": "deadline_watch", "name": "54. 課題締切トラッキングAI", "emoji": "📚", "floor": "K", "schedule": "毎日 07:00"},
    {"id": "spam_detect",    "name": "23. 不正投稿検知AI",       "emoji": "🛠️", "floor": "D", "schedule": "毎日 03:00"},
    {"id": "news_digest",    "name": "60. 今日のニュース抽出AI",  "emoji": "📰", "floor": "B", "schedule": "8時間ごと（06:30起点）"},
    {"id": "financial_snapshot", "name": "42. 財務・事業ダッシュボードAI要約", "emoji": "💰", "floor": "H", "schedule": "毎日 07:45"},
]
LOCAL_AGENT_IDS = {a["id"] for a in LOCAL_AGENTS}

# 2026-07-01にunified_schedulerへ統合済み。旧pidファイルが残っていても実体は無いので除外。
LEGACY_MERGED = {
    "model_training_scheduler", "paper_exit_executor",
    "morning_report_scheduler", "weekend_backtest_runner",
    "news_watchlist_scanner",
}

# フロア定義（社長室が最上階、以下 戦略メモ_エージェント構想_20260708.md のA〜Kに対応）
FLOORS = [
    {"id": "exec",  "name": "社長室",              "emoji": "👑", "order": 0},
    {"id": "A",     "name": "組織運営・秘書",        "emoji": "🗂️", "order": 1},
    {"id": "B",     "name": "マーケティング・営業",   "emoji": "📣", "order": 2},
    {"id": "C",     "name": "コンテンツ・広報",       "emoji": "🦊", "order": 3},
    {"id": "D",     "name": "プロダクト運用",        "emoji": "🛠️", "order": 4},
    {"id": "E",     "name": "コミュニティ運営",       "emoji": "🤝", "order": 5},
    {"id": "F",     "name": "HR・採用インターン",     "emoji": "🎓", "order": 6},
    {"id": "G",     "name": "自治体・観光(B2G)",      "emoji": "🏯", "order": 7},
    {"id": "H",     "name": "財務・投資（moomooエンジン室）", "emoji": "💰", "order": 8},
    {"id": "I",     "name": "データ・分析R&D",        "emoji": "📊", "order": 9},
    {"id": "J",     "name": "新規事業探索",           "emoji": "🌱", "order": 10},
    {"id": "K",     "name": "学生課題支援",           "emoji": "📚", "order": 11},
]

# name -> (表示名, キャラ絵文字, フロアID)
MOOMOO_AGENTS = {
    "live_order_executor":     ("発注執行",     "🐆", "H"),
    "auto_approver":           ("自動承認",     "🦉", "H"),
    "order_lifecycle_manager": ("注文ライフサイクル管理", "🐢", "H"),
    "position_exit_monitor":   ("ポジション監視", "🦅", "H"),
    "schema2_screening":       ("銘柄スクリーニング", "🐿️", "H"),
    "crypto_executor":         ("BTC執行",      "🐯", "H"),
    "btc_executor":            ("BTC執行(旧)",  "🐯", "H"),
    "unified_scheduler":       ("統合スケジューラ(朝レポ/学習/ニュース/週末BT)", "🐘", "H"),
    "backend":                 ("APIサーバー",  "🏠", "H"),
    "frontend":                ("フロントエンド", "🖥️", "H"),
    "cloudflare_tunnel":       ("外部トンネル", "🌉", "H"),
    "env_watcher":             ("設定監視",     "🐁", "H"),
    "network_watchdog":        ("ネットワーク監視", "🐕", "H"),
    "guardian":                ("全体監視",     "🐻", "H"),
    "infra_watchdog":          ("番犬",         "🐺", "H"),
    "thermal_guardian":        ("発熱監視",     "🐨", "H"),
    "run_servers":             ("プロセス管理", "🎛️", "H"),
    "auto_git_sync":           ("自動Git同期",  "🐙", "H"),
    "cloud_backup":            ("クラウド保存", "🐫", "H"),
}

# 戦略メモ_エージェント構想_20260708.md の59案。まだ実装されていない「空きオフィス」。
VACANT_AGENTS = [
    ("A", 1, "秘書AI"), ("A", 2, "スケジュール番人"),
    ("A", 4, "議事録要約AI"), ("A", 5, "意思決定ログ検索AI"), ("A", 6, "燃え尽き検知番人"),

    ("B", 7, "痕跡プロファイリングAI(企業版)"), ("B", 8, "縁のデータベース番人"),
    ("B", 9, "競合・市場調査エージェント"), ("B", 10, "リード温度感スコアリングAI"),
    ("B", 11, "ピッチ資料差分生成AI"), ("B", 12, "イベント名刺フォローアップAI"),

    ("C", 13, "X/Note下書きAI"), ("C", 14, "提案書ドラフトAI"), ("C", 15, "痕跡ストーリー化AI"),
    ("C", 16, "共鳴分析AI"), ("C", 17, "採用PR動画構成案AI"), ("C", 18, "メディア言及モニタAI"),

    ("D", 20, "スポンサー・自治体トリアージAI"),
    ("D", 21, "イベント公開前チェックAI"),
    ("D", 24, "オンボーディング離脱分析AI"),

    ("E", 25, "ホスト伴走AI"), ("E", 26, "参加者共鳴マッチングAI"),
    ("E", 27, "コミュニティ健全性番人"), ("E", 28, "推譲サイクル可視化AI"),
    ("E", 29, "離脱予兆検知AI"),

    ("F", 30, "社員トレーディングカード自動生成AI"), ("F", 31, "インターン参加者事前マッチングAI"),
    ("F", 32, "4フェーズ進行管理AI"), ("F", 33, "痕跡解読トレーニングAI"),
    ("F", 34, "OB/OGネットワークAI"),

    ("G", 35, "関係人口ダッシュボードAI"), ("G", 36, "地域特集ページ自動編集AI"),
    ("G", 37, "移住定住導線分析AI"), ("G", 38, "デジタル観光大使AIナビゲーター"),
    ("G", 39, "学校遠足安全管理AI"), ("G", 40, "ふるさと納税連携提案AI"),
    ("G", 41, "自治体向け提案書自動カスタマイズAI"),

    ("H", 43, "投資リターン追跡・リバランス提案AI"),
    ("H", 44, "事業別採算モニタAI"), ("H", 45, "助成金・補助金スキャンAI"),

    ("I", 46, "統合司令室AI"), ("I", 47, "痕跡データパターン分析AI"),
    ("I", 48, "UI改善A/Bテスト自動集計AI"), ("I", 49, "競合プロダクト機能差分モニタAI"),

    ("J", 50, "新規事業仮説生成AI"), ("J", 51, "海外展開リサーチAI"),
    ("J", 52, "産学連携リサーチAI"), ("J", 53, "追悼・周年史アーカイブAI"),

    ("K", 55, "文献収集AI"),
    ("K", 56, "参考文献フォーマッターAI"), ("K", 57, "授業ノート構造化AI"),
    ("K", 58, "レポート骨子AI"), ("K", 59, "ゼミ・グループ課題進捗トラッカーAI"),
]


_live_pids_cache: tuple[float, set[str]] = (0.0, set())


def _live_pids() -> set[str]:
    """tasklistの全件取得は~1.5秒かかるため、直近3秒はキャッシュを使い回す。"""
    global _live_pids_cache
    cached_at, pids = _live_pids_cache
    if time.monotonic() - cached_at < 3:
        return pids
    try:
        out = subprocess.run(
            ["tasklist", "/FO", "CSV", "/NH"],
            capture_output=True, text=True, timeout=5,
        ).stdout
        pids = {line.split('","')[1] for line in out.splitlines() if '","' in line}
    except Exception:
        pids = set()
    _live_pids_cache = (time.monotonic(), pids)
    return pids


def _schtasks_exists(name: str) -> bool:
    try:
        r = subprocess.run(["schtasks", "/Query", "/TN", name],
                            capture_output=True, text=True, timeout=5)
        return r.returncode == 0
    except Exception:
        return False


def collect_moomoo_agents() -> list[dict]:
    agents = []
    seen = set()
    if MOOMOO_WORK.exists():
        live_pids = _live_pids()
        for pid_file in MOOMOO_WORK.glob("*.pid"):
            key = pid_file.stem
            if key in LEGACY_MERGED:
                continue
            if key == "crypto_executor" and "btc_executor" in seen:
                continue
            seen.add(key)
            pid = pid_file.read_text(encoding="utf-8").strip()
            alive = bool(pid) and pid in live_pids
            label, emoji, floor = MOOMOO_AGENTS.get(key, (key, "🐣", "H"))
            agents.append({
                "id": f"moomoo:{key}",
                "name": label,
                "emoji": emoji,
                "floor": floor,
                "project": "moomoo",
                "status": "working" if alive else "resting",
                "detail": f"PID {pid}" if alive else "プロセスなし（停止中）",
            })
    else:
        agents.append({
            "id": "moomoo:unreachable",
            "name": "moomoo全体",
            "emoji": "❓",
            "floor": "H",
            "project": "moomoo",
            "status": "unknown",
            "detail": f"作業フォルダが見つかりません: {MOOMOO_WORK}",
        })
    return agents


def collect_affiliate_agent() -> dict:
    running = AFFILIATE_FLAG.exists()
    last_run = None
    keywords = []
    if AFFILIATE_RESULTS.exists():
        try:
            data = json.loads(AFFILIATE_RESULTS.read_text(encoding="utf-8"))
            if data:
                last_run = data[0].get("date")
                keywords = data[0].get("keywords", [])
        except Exception:
            pass
    scheduled = _schtasks_exists("HitomapAffiliate")
    if running:
        detail = "記事生成・note投稿を実行中…"
    elif last_run:
        detail = f"前回実行: {last_run}（{'、'.join(keywords[:3])}）"
    else:
        detail = "実行履歴なし"
    if not scheduled:
        detail += " ／ ⚠️毎朝7時の自動実行は未登録（register_task.ps1が未実行）"
    return {
        "id": "affiliate:main",
        "name": "アフィリエイト記事生成",
        "emoji": "🦊",
        "floor": "C",
        "project": "affiliate-auto",
        "status": "working" if running else "resting",
        "detail": detail,
        "scheduled": scheduled,
    }


def _summarize_local_result(agent_id: str, result: dict | None) -> str:
    if result is None:
        return "実行履歴なし（次回のスケジュール実行を待っています）"
    if "error" in result:
        return f"⚠️ {result['error']}"
    if agent_id == "approval_watch":
        return f"監視対象{result.get('total', 0)}件中、3日以上滞留{result.get('stale_count', 0)}件"
    if agent_id == "report_screen":
        return (f"未処理の通報{result.get('pending_count', 0)}件"
                f"（スパム疑い{result.get('spam_suspected', 0)}／個人情報疑い{result.get('pii_suspected', 0)}"
                f"／要人間判断{result.get('gray', 0)}）")
    if agent_id == "trace_qa":
        return f"データ不整合の疑い{result.get('issue_count', 0)}件"
    if agent_id == "deadline_watch":
        return f"未完了課題{result.get('pending_count', 0)}件中、3日以内の締切{result.get('urgent_count', 0)}件"
    if agent_id == "spam_detect":
        return (f"直近{result.get('checked', 0)}件を検査、重複タイトル{result.get('duplicate_title_count', 0)}件"
                f"／バースト投稿{result.get('burst_session_count', 0)}件")
    if agent_id == "news_digest":
        return f"当日ニュース{result.get('total', 0)}件を収集／Discord投稿: {result.get('post_result', '未実行')}"
    if agent_id == "financial_snapshot":
        p, a, m = result.get("product", {}), result.get("affiliate", {}), result.get("moomoo", {})
        return (f"痕跡投稿 累計{p.get('total_traces', '?')}件(今週+{p.get('new_this_week', '?')})／"
                f"affiliate記事 今週{a.get('articles_this_week', '?')}本／"
                f"moomoo稼働プロセス {m.get('processes_alive', '?')}/{m.get('processes_total', '?')}")
    return "実行済み"


def collect_local_agents() -> list[dict]:
    agents = []
    for meta in LOCAL_AGENTS:
        agent_id = meta["id"]
        flag = LOCAL_AGENTS_WORK / f"{agent_id}.flag"
        result_path = LOCAL_AGENTS_WORK / f"{agent_id}.json"
        result = None
        if result_path.exists():
            try:
                result = json.loads(result_path.read_text(encoding="utf-8"))
            except Exception:
                result = None
        working = flag.exists()
        agents.append({
            "id": f"local:{agent_id}",
            "name": meta["name"],
            "emoji": meta["emoji"],
            "floor": meta["floor"],
            "project": "hitomap-agents",
            "status": "working" if working else "resting",
            "detail": "実行中…" if working else _summarize_local_result(agent_id, result),
            "meta": result,
            "runnable": True,
            "schedule": meta.get("schedule", ""),
        })
    return agents


def collect_vacant_agents() -> list[dict]:
    floor_emoji = {f["id"]: f["emoji"] for f in FLOORS}
    return [
        {
            "id": f"vacant:{num}",
            "name": f"{num}. {name}",
            "emoji": floor_emoji.get(floor, "🚧"),
            "floor": floor,
            "project": "構想",
            "status": "vacant",
            "detail": "未着工（戦略メモ_エージェント構想_20260708.md）",
        }
        for floor, num, name in VACANT_AGENTS
    ]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        if self.path.startswith("/api/run"):
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            agent_id = (qs.get("id") or [""])[0]
            if agent_id not in LOCAL_AGENT_IDS:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": "不明なエージェントID"}).encode("utf-8"))
                return
            script = LOCAL_AGENTS_DIR / f"{agent_id}.py"
            # 管理画面からの手動実行。スケジュール実行と同じスクリプトを、待たずにバックグラウンドで起動する。
            subprocess.Popen(["python", str(script)], cwd=str(LOCAL_AGENTS_DIR))
            self.send_response(202)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "started": agent_id}, ensure_ascii=False).encode("utf-8"))
            return
        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/status":
            agents = (collect_moomoo_agents() + [collect_affiliate_agent()]
                      + collect_local_agents() + collect_vacant_agents())
            working = sum(1 for a in agents if a["status"] == "working")
            vacant = sum(1 for a in agents if a["status"] == "vacant")
            resting = len(agents) - working - vacant
            body = json.dumps({
                "generated_at": datetime.now().isoformat(),
                "total": len(agents),
                "working": working,
                "resting": resting,
                "vacant": vacant,
                "floors": FLOORS,
                "agents": agents,
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            return

        path = "index.html" if self.path == "/" else self.path.lstrip("/")
        file_path = DASHBOARD_DIR / path
        if file_path.exists() and file_path.is_file():
            self.send_response(200)
            ctype = "text/html" if file_path.suffix == ".html" else "text/plain"
            self.send_header("Content-Type", f"{ctype}; charset=utf-8")
            self.end_headers()
            self.wfile.write(file_path.read_bytes())
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    print(f"ヒトマップビル起動: http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
