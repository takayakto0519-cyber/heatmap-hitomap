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
# 番人一覧の一次情報源は lib/agents/roster.ts。`node scripts/export-agent-roster.mjs` が
# 書き出す agents/roster.generated.json を読む（三重管理をやめ、roster.ts 1箇所に集約）。
def _load_local_agents():
    roster_json = LOCAL_AGENTS_DIR / "roster.generated.json"
    try:
        data = json.loads(roster_json.read_text(encoding="utf-8"))
        scripts = data.get("scripts") or []
        if scripts:
            return [
                {"id": a["id"], "name": a["name"], "emoji": a["emoji"],
                 "floor": a["floor"], "schedule": a.get("schedule", "")}
                for a in scripts
            ]
    except Exception:
        pass
    # フォールバック：JSON未生成でもwork/*.jsonから最低限拾う
    return [
        {"id": p.stem, "name": p.stem, "emoji": "🤖", "floor": "A", "schedule": ""}
        for p in sorted(LOCAL_AGENTS_WORK.glob("*.json"))
        if p.stem != "xp"
    ]


LOCAL_AGENTS = _load_local_agents()
LOCAL_AGENT_IDS = {a["id"] for a in LOCAL_AGENTS}

# --- ここから 2026-07-18 追加：AgentRoom風UIの編集・XP・日報のための土台 ---

# UIから編集した表示上書き（名前・絵文字・メモ）の保存先
AGENT_CONFIG_FILE = DASHBOARD_DIR / "agent_config.json"
XP_FILE = DASHBOARD_DIR.parent / "agents" / "work" / "xp.json"

# UIの「詳細編集」で開いてよいファイルのホワイトリスト。
# 会長が細かい編集をここから行う。任意ファイル書き込みは許さない（安全のため列挙式）。
ROOT_DIR = DASHBOARD_DIR.parent
EDITABLE_FILES = {
    "収益化イニシアチブ": ROOT_DIR / "01_経営幹部_Executive" / "収益化イニシアチブ.md",
    "学生課題の締切": ROOT_DIR / "学生課題" / "締切.md",
    "LINE縁ミッション設定": ROOT_DIR / "agents" / "line_bot" / "config.json",
    "営業メール ターゲット": ROOT_DIR / "営業メール" / "targets.json",
    "営業メール 文面テンプレート": ROOT_DIR / "営業メール" / "template.md",
}


def load_agent_config() -> dict:
    if AGENT_CONFIG_FILE.exists():
        try:
            return json.loads(AGENT_CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def load_xp() -> dict:
    if XP_FILE.exists():
        try:
            return json.loads(XP_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def xp_to_level(total: int) -> dict:
    """累計実行回数からレベルと次レベルまでの進捗を出す。5回ごとに1レベル。"""
    level = 1 + total // 5
    into = total % 5
    return {"level": level, "xp": total, "into": into, "need": 5}


def monthly_mvp(xp: dict) -> str | None:
    """今月いちばん働いたローカル番人のidを返す。"""
    month = datetime.now().strftime("%Y-%m")
    best_id, best_n = None, 0
    for aid, rec in xp.items():
        n = int((rec.get("monthly") or {}).get(month, 0))
        if n > best_n:
            best_id, best_n = aid, n
    return best_id if best_n > 0 else None
# --- 追加ここまで ---

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

# 「空きオフィス」も roster.generated.json（roster.ts由来）から読む。
# 番人＋スキルでロードマップをほぼ実装済みのため、通常は空（0件）。将来また空きが出れば反映される。
def _load_vacant_agents():
    roster_json = LOCAL_AGENTS_DIR / "roster.generated.json"
    try:
        data = json.loads(roster_json.read_text(encoding="utf-8"))
        return [(v["floor"], v.get("num") or 0, v["name"]) for v in (data.get("vacant") or [])]
    except Exception:
        return []


VACANT_AGENTS = _load_vacant_agents()


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
    if agent_id == "case_pipeline_watch":
        by_stage = result.get("by_stage", {})
        stage_str = "、".join(f"{k}{v}件" for k, v in by_stage.items()) if by_stage else "案件0件"
        stale = result.get("stale_count", 0)
        return f"{stage_str}" + (f" ／⚠️7日以上停滞{stale}件" if stale else "")
    if agent_id == "revenue_initiative_watch":
        active, done, stale = result.get("active_count", 0), result.get("done_count", 0), result.get("stale_count", 0)
        return f"進行中の施策{active}件（完了{done}件）" + (f" ／⚠️14日以上停滞{stale}件" if stale else "")
    if agent_id == "office_diary":
        lines = result.get("lines", [])
        return lines[1] if len(lines) > 1 else "日報を書きました"
    if agent_id == "lead_temperature":
        return f"リード{result.get('total', 0)}件をスコア化、🔥熱いリード{result.get('hot_count', 0)}件"
    if agent_id == "payment_watch":
        u = result.get("unpaid_count", 0)
        return f"請求済み{result.get('billed_count', 0)}件" + (f" ／⚠️未入金{u}件" if u else " ／未入金なし")
    if agent_id == "lost_deal_archive":
        return f"失注として記録した案件{result.get('lost_count', 0)}件"
    if agent_id == "schedule_watch":
        return f"次アクション{result.get('action_count', 0)}件、緊急締切{len(result.get('urgent_deadlines', []))}件"
    if agent_id == "burnout_watch":
        w = result.get("warnings", [])
        return w[0] if w else f"連続作業{result.get('current_streak', 0)}日・深夜作業{result.get('late_night_commits_14d', 0)}回（健全）"
    if agent_id == "line_mission":
        if result.get("skipped"):
            return result.get("status", "次の縁ミッションを待機中")
        pair = result.get("pair", [])
        return (f"縁ミッション: {pair[0]}×{pair[1]} — {result.get('pushed', '')}"[:60]) if pair else result.get("status", "")
    if agent_id == "email_queue":
        return f"送り先{result.get('target_count', 0)}社、未送信の下書き{result.get('pending_send', 0)}件（送信は会長が手動）"
    if agent_id == "trace_pattern":
        if result.get("total", 0) == 0:
            return "まだ痕跡データがありません"
        ph = "・".join(result.get("peak_hours", [])[:2])
        return f"痕跡{result.get('total', 0)}件を分析、また来たい率{result.get('want_revisit_rate', 0)}%、投稿ピーク{ph}"
    if agent_id == "relation_population":
        return f"関わった人{result.get('total_contributors', 0)}人、複数回関わった芽{result.get('repeat_contributors', 0)}人（また来たい{result.get('want_revisit_people', 0)}人）"
    if agent_id == "competitor_market_research":
        return f"競合・市場ニュース{result.get('total', 0)}件を収集（4カテゴリ）"
    if agent_id == "marketing_digest":
        return f"マーケティング日報：{result.get('sections', 0)}分野をDiscordへ報告（{result.get('post_result', '未実行')}）"
    if agent_id == "competitor_feature_monitor":
        u = result.get("update_count", 0)
        return f"名指し競合の関連報道{result.get('total', 0)}件" + (f" ／新機能・更新らしき報道{u}件" if u else "")
    if agent_id == "ab_test_summary_watch":
        if result.get("test_count"):
            return f"実施中のA/Bテスト{result['test_count']}件を集計"
        return result.get("note", "まだ計測データがありません")
    if agent_id == "new_biz_signal_watch":
        kw = result.get("top_keywords") or []
        head = kw[0]["word"] if kw else None
        return (f"「なぜ」欄の頻出フレーズ{len(kw)}件（最多: {head}）" if head else "まだ目立つ頻出フレーズなし") + f" ／長期停滞中の事業案{result.get('stale_idea_count', 0)}件"
    if agent_id == "global_market_watch":
        return f"海外の市場ニュース{result.get('total', 0)}件を収集（英語圏）"
    if agent_id == "academic_partnership_watch":
        return f"産学連携ニュース{result.get('total', 0)}件を収集"
    if agent_id == "memorial_anniversary_watch":
        n = result.get("upcoming_count", 0)
        return f"2週間以内に節目を迎えるアーカイブ{n}件" if n else f"該当なし（登録済みアーカイブ{result.get('archive_total', 0)}件中、日付を特定できたもの{result.get('date_parsed_count', 0)}件）"
    if agent_id == "command_center":
        n = result.get("attention_count", 0)
        return f"要注意項目{n}件" if n else "全フロア異常なし"
    if agent_id == "calendar_watch":
        if not result.get("connected"):
            return "未連携（agents/secrets/README.md の手順が未実施）"
        today_n = len(result.get("today", []))
        tomorrow_n = len(result.get("tomorrow", []))
        if today_n == 0:
            return f"今日の予定なし（明日{tomorrow_n}件）"
        first = result["today"][0]
        return f"今日{today_n}件（次: {first.get('title', '')}） ／ 明日{tomorrow_n}件"
    if agent_id == "financial_snapshot":
        p, a, m = result.get("product", {}), result.get("affiliate", {}), result.get("moomoo", {})
        return (f"痕跡投稿 累計{p.get('total_traces', '?')}件(今週+{p.get('new_this_week', '?')})／"
                f"affiliate記事 今週{a.get('articles_this_week', '?')}本／"
                f"moomoo稼働プロセス {m.get('processes_alive', '?')}/{m.get('processes_total', '?')}")
    return "実行済み"


def collect_local_agents() -> list[dict]:
    agents = []
    config = load_agent_config()
    xp = load_xp()
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
        # UIから編集した上書き（名前・絵文字・メモ）を適用
        ov = config.get(agent_id, {})
        name = ov.get("name") or meta["name"]
        emoji = ov.get("emoji") or meta["emoji"]
        note = ov.get("note", "")
        xp_rec = xp.get(agent_id, {})
        level = xp_to_level(int(xp_rec.get("total", 0)))
        agents.append({
            "id": f"local:{agent_id}",
            "name": name,
            "emoji": emoji,
            "floor": meta["floor"],
            "project": "hitomap-agents",
            "status": "working" if working else "resting",
            "detail": "実行中…" if working else _summarize_local_result(agent_id, result),
            "note": note,
            "meta": result,
            "runnable": True,
            "editable": True,
            "schedule": ov.get("schedule") or meta.get("schedule", ""),
            "level": level["level"],
            "xp": level["xp"],
            "xp_into": level["into"],
            "xp_need": level["need"],
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

    def _read_body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b""
            return json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            return {}

    def _json(self, code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

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

        if self.path == "/api/agent-config":
            # UIからのエージェント表示上書き保存（名前・絵文字・メモ・スケジュール）
            body = self._read_body()
            agent_id = (body.get("id") or "").replace("local:", "")
            if agent_id not in LOCAL_AGENT_IDS:
                return self._json(400, {"ok": False, "error": "不明なエージェントID"})
            config = load_agent_config()
            entry = config.get(agent_id, {})
            for k in ("name", "emoji", "note", "schedule"):
                if k in body:
                    entry[k] = body[k]
            config[agent_id] = entry
            try:
                AGENT_CONFIG_FILE.write_text(
                    json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception as e:
                return self._json(500, {"ok": False, "error": str(e)})
            return self._json(200, {"ok": True, "saved": entry})

        if self.path == "/api/edit-file":
            # ホワイトリストされたデータファイルの中身をUIから保存
            body = self._read_body()
            key = body.get("key", "")
            content = body.get("content", "")
            target = EDITABLE_FILES.get(key)
            if target is None:
                return self._json(400, {"ok": False, "error": "編集できないファイルです"})
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
            except Exception as e:
                return self._json(500, {"ok": False, "error": str(e)})
            return self._json(200, {"ok": True, "saved": key})

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/editable-files":
            # 編集可能ファイルの一覧と現在の中身を返す
            files = []
            for key, path in EDITABLE_FILES.items():
                content = ""
                if path.exists():
                    try:
                        content = path.read_text(encoding="utf-8")
                    except Exception:
                        content = ""
                files.append({"key": key, "exists": path.exists(), "content": content})
            return self._json(200, {"files": files})

        if self.path == "/api/office-diary":
            diary = None
            p = LOCAL_AGENTS_WORK / "office_diary.json"
            if p.exists():
                try:
                    diary = json.loads(p.read_text(encoding="utf-8"))
                except Exception:
                    diary = None
            return self._json(200, {"diary": diary})

        if self.path == "/api/pipeline":
            def _read_json(p: Path) -> dict | None:
                if not p.exists():
                    return None
                try:
                    return json.loads(p.read_text(encoding="utf-8"))
                except Exception:
                    return None
            body = json.dumps({
                "generated_at": datetime.now().isoformat(),
                "case_pipeline": _read_json(LOCAL_AGENTS_WORK / "case_pipeline_watch.json"),
                "revenue_initiatives": _read_json(LOCAL_AGENTS_WORK / "revenue_initiative_watch.json"),
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/api/status":
            agents = (collect_moomoo_agents() + [collect_affiliate_agent()]
                      + collect_local_agents() + collect_vacant_agents())
            working = sum(1 for a in agents if a["status"] == "working")
            vacant = sum(1 for a in agents if a["status"] == "vacant")
            resting = len(agents) - working - vacant
            xp = load_xp()
            mvp_id = monthly_mvp(xp)
            body = json.dumps({
                "generated_at": datetime.now().isoformat(),
                "total": len(agents),
                "working": working,
                "resting": resting,
                "vacant": vacant,
                "floors": FLOORS,
                "agents": agents,
                "mvp": f"local:{mvp_id}" if mvp_id else None,
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
