"""エージェント共通ユーティリティ — 実行中フラグと結果ファイルの管理"""
import json
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

AGENTS_DIR = Path(__file__).parent
WORK_DIR = AGENTS_DIR / "work"
WORK_DIR.mkdir(exist_ok=True)
ROOT = AGENTS_DIR.parent

# 商談デモ用の合成データ（scripts/seed-demo-sales-data.mjs）のタグ。
# 集計系の番人はこれを含む行を数字に混ぜないよう、フィルタしてから集計すること。
DEMO_SESSION_CODE = "demo-sales-20260720"


@contextmanager
def running(agent_id: str):
    flag = WORK_DIR / f"{agent_id}.flag"
    flag.write_text(datetime.now().isoformat(), encoding="utf-8")
    _bump_xp(agent_id)
    try:
        yield
    finally:
        flag.unlink(missing_ok=True)


def _bump_xp(agent_id: str):
    """エージェントが1回動くたびに経験値を+1する（累計と今月分）。
    ダッシュボードのレベル表示・月間MVP表彰に使う。壊れても本業を止めない。"""
    try:
        xp_path = WORK_DIR / "xp.json"
        data = {}
        if xp_path.exists():
            data = json.loads(xp_path.read_text(encoding="utf-8"))
        month = datetime.now().strftime("%Y-%m")
        rec = data.get(agent_id) or {"total": 0, "monthly": {}}
        rec["total"] = int(rec.get("total", 0)) + 1
        monthly = rec.get("monthly") or {}
        monthly[month] = int(monthly.get(month, 0)) + 1
        rec["monthly"] = monthly
        rec["last_run"] = datetime.now().isoformat()
        data[agent_id] = rec
        xp_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def write_result(agent_id: str, data: dict):
    payload = {**data, "generated_at": datetime.now().isoformat()}
    (WORK_DIR / f"{agent_id}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def read_result(agent_id: str) -> dict | None:
    path = WORK_DIR / f"{agent_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def read_case_cards() -> list[dict]:
    """04_人事クライアント管理_HR_Client/案件/ の案件カルテを読み、
    フロントマター(dict)＋本文(body)＋ファイル名を返す。番人が共通で使う。"""
    import re
    case_dir = ROOT / "04_人事クライアント管理_HR_Client" / "案件"
    cards = []
    if not case_dir.exists():
        return cards
    fm_re = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)
    field_re = re.compile(r'^(\w+):\s*"?(.*?)"?\s*$')
    for f in sorted(case_dir.glob("*.md")):
        if f.name == "_テンプレート.md":
            continue
        text = f.read_text(encoding="utf-8")
        m = fm_re.match(text)
        fields, body = {}, text
        if m:
            body = m.group(2)
            for line in m.group(1).splitlines():
                if not line.strip() or line.startswith(" ") or line.startswith("-"):
                    continue
                fm = field_re.match(line)
                if fm:
                    fields[fm.group(1)] = fm.group(2).strip()
        cards.append({"file": f.name, "fields": fields, "body": body})
    return cards


def load_env_local() -> dict:
    env = {}
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return env
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env
