"""AI成果物パイプライン・オートパイロット — この番人だけがAIを呼ぶ。
agents/proposal_queue_watch.py が書き出したキュー(work/proposal_queue_watch.json)を
先頭から MAX_PER_RUN 件だけ取り、`.claude/skills/autopilot/SKILL.md` を1件ずつ
`claude -p` でヘッドレス起動する。APIキーは持たない（Claude Codeのサブスク内で完結）。

ps1から直接 `claude -p` を叩かずこのPythonラッパーを挟むのは、ダッシュボードの死活監視が
agent_id=スクリプトファイル名で work/*.flag を見るため（他の番人と同じ形にしないと監視から漏れる）。

安全設計（変更する場合は必ずSKILL.md側の「絶対にしないこと」も合わせて確認すること）：
- 1回の実行で処理するのは MAX_PER_RUN 件まで、1件あたり TIMEOUT_SEC 秒で打ち切る。
- 3件連続失敗したら中断する（他の番人・後続処理を巻き込まない）。
- 生のstdoutは autopilot.log に追記（上限を超えたら先頭を捨てる）。要約は common.write_result で残す。
"""
import os
import subprocess
import shutil
import sys
from pathlib import Path

import common

MAX_PER_RUN = 3
# deep-research込みのkind（validation_research/mvp_spec/mvp_content/quote_research/
# biz_hypothesis/content_theme。.claude/skills/autopilot/SKILL.md 手順3参照）は
# 複数エージェントでの調査を伴い10分を超えることがある
# （2026-07-24、600秒では新規事業の需要検証が2件連続タイムアウトした教訓）。
# タスクスケジューラ側のExecutionTimeLimit（register_tasks.ps1、HitomapAutopilotは90分）と
# 揃えること——Python側だけ延ばしてもOSに途中で殺されては意味がない。
TIMEOUT_SEC = 1500
# 2026-07-24追記：biz_model_ideasの検証待ちバックログ(約9件)により、キューの上位が
# validation_research(deep-research)で埋まり、MAX_PER_RUN=3のうち2枠が毎日重い調査に
# 消費される事態が発生（会長「トークン消費が激しくなる」懸念）。deep-research系kindは
# 1回の実行で1件までに絞り、残り枠は軽いkind（contact/email_draft等）に譲ることで
# 日々のピーク消費を抑える。バックログの解消自体は日数がかかるだけで止めない。
HEAVY_KINDS = {"evidence", "mvp_content", "quote_research", "biz_hypothesis", "validation_research", "content_theme"}
MAX_HEAVY_PER_RUN = 1
MAX_CONSECUTIVE_FAILURES = 3
LOG_PATH = common.WORK_DIR / "autopilot.log"
LOG_MAX_BYTES = 1_000_000

# オートパイロットが読み書きしてよい範囲。SKILL.md 側の「絶対にしないこと」と対応させる。
# Workflowは調査系kind（evidence/mvp_content/quote_research）でdeep-researchスキルを
# 使うために許可している（deep-researchは内部でWorkflowによる複数エージェント調査を行う）。
# パス指定の書き込み許可はEdit(path)の形式でないと効かない（Write(path)は無視される —
# 2026-07-24、この誤記のせいで06番地への保存もPOSTペイロードの一時ファイルも書けず
# 成果物が1件もai_deliverablesに載らないまま「成功」扱いになっていた事故の教訓）。
# agents/work/**は「Windows curlで日本語を直渡しするとDB側で化ける」問題を避けるため、
# POSTペイロードを一時ファイルに書いてcurl --data-binary @fileで送るのに必要。
ALLOWED_TOOLS = "Read,Glob,Grep,WebSearch,WebFetch,Skill,Workflow,Edit(06_実行待機_Approval/**),Edit(agents/work/**),Bash(curl:*)"


def _find_claude() -> str | None:
    return shutil.which("claude")


def _append_log(text: str) -> None:
    try:
        prior = LOG_PATH.read_text(encoding="utf-8", errors="ignore") if LOG_PATH.exists() else ""
        combined = prior + text
        if len(combined.encode("utf-8", errors="ignore")) > LOG_MAX_BYTES:
            combined = combined[-LOG_MAX_BYTES:]
        LOG_PATH.write_text(combined, encoding="utf-8")
    except Exception:
        pass  # ログの failure で本業を止めない


def _prompt_for(item: dict) -> str:
    kind = item.get("kind") or "email_draft"
    entity_type = item.get("entity_type") or "municipality_profile"
    entity_id = item.get("entity_id")  # 新規事業の仮説・SNS投稿案は対象の行が無いため None
    revise = " revise=true" if item.get("revise") else ""
    entity_id_arg = f" entity_id={entity_id}" if entity_id else ""
    return f"/autopilot kind={kind} entity_type={entity_type}{entity_id_arg}{revise}"


def main():
    with common.running("autopilot"):
        claude = _find_claude()
        if not claude:
            common.write_result("autopilot", {"error": "claude CLIが見つかりません（PATHを確認してください）"})
            return

        queue = common.read_result("proposal_queue_watch")
        if not queue or queue.get("error"):
            common.write_result("autopilot", {"error": "proposal_queue_watchの結果が読めません。先にその番人を実行してください"})
            return

        # 優先順位（差し戻し→営業→生成）は proposal_queue_watch.py 側の並びをそのまま尊重する。
        # ここでは「重いkindを1件に絞る」フィルタだけをかけ、溢れた重いkindは翌日以降に持ち越す
        # （スキップした分だけ後続の軽いkindが繰り上がるので、枠を無駄にしない）。
        full_queue = queue.get("ai_queue") or []
        items, skipped_heavy = [], []
        heavy_used = 0
        for item in full_queue:
            if len(items) >= MAX_PER_RUN:
                break
            if item.get("kind") in HEAVY_KINDS:
                if heavy_used >= MAX_HEAVY_PER_RUN:
                    skipped_heavy.append({"region_name": item.get("region_name"), "kind": item.get("kind")})
                    continue
                heavy_used += 1
            items.append(item)

        processed, failed = [], []
        consecutive_failures = 0

        # 設計上「APIキーは持たない（サブスク内で完結）」なので、環境変数に紛れ込んだ
        # ANTHROPIC_API_KEY は明示的に外す。呼び出し元のシェルや.envに古い/無効なキーが
        # 残っていても、claude -p が誤ってAPIキー認証を試みて401になる事故を防ぐ
        # （2026-07-24、.env.localの失効済みキーが原因と疑われる401で3件連続失敗した教訓）。
        clean_env = os.environ.copy()
        clean_env.pop("ANTHROPIC_API_KEY", None)

        for item in items:
            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                break
            prompt = _prompt_for(item)
            try:
                result = subprocess.run(
                    [claude, "-p", prompt, "--allowedTools", ALLOWED_TOOLS],
                    cwd=str(common.ROOT), timeout=TIMEOUT_SEC, env=clean_env,
                    capture_output=True, text=True, encoding="utf-8", errors="ignore",
                )
                _append_log(f"\n=== {item.get('region_name')} / {item.get('kind')} ===\n{result.stdout}\n{result.stderr}\n")
                if result.returncode == 0:
                    processed.append({"region_name": item.get("region_name"), "kind": item.get("kind")})
                    consecutive_failures = 0
                else:
                    failed.append({"region_name": item.get("region_name"), "kind": item.get("kind"), "returncode": result.returncode})
                    consecutive_failures += 1
            except subprocess.TimeoutExpired:
                failed.append({"region_name": item.get("region_name"), "kind": item.get("kind"), "error": "timeout"})
                consecutive_failures += 1
            except Exception as e:
                failed.append({"region_name": item.get("region_name"), "kind": item.get("kind"), "error": str(e)})
                consecutive_failures += 1

        common.write_result("autopilot", {
            "queued": len(items),
            "processed": processed,
            "failed": failed,
            "skipped_heavy": skipped_heavy,
            "aborted_early": consecutive_failures >= MAX_CONSECUTIVE_FAILURES,
            "note": "AI APIキーは使わずclaude -pのサブスク実行のみ。送信・事実確認確定はここでは一切行わない。"
                    f"deep-research系kindは1回{MAX_HEAVY_PER_RUN}件までに制限（トークン消費の平準化）。",
        })


if __name__ == "__main__":
    sys.exit(main() or 0)
