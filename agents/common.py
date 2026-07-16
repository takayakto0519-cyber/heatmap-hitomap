"""エージェント共通ユーティリティ — 実行中フラグと結果ファイルの管理"""
import json
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

AGENTS_DIR = Path(__file__).parent
WORK_DIR = AGENTS_DIR / "work"
WORK_DIR.mkdir(exist_ok=True)
ROOT = AGENTS_DIR.parent


@contextmanager
def running(agent_id: str):
    flag = WORK_DIR / f"{agent_id}.flag"
    flag.write_text(datetime.now().isoformat(), encoding="utf-8")
    try:
        yield
    finally:
        flag.unlink(missing_ok=True)


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
