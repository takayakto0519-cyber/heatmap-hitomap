"""AI成果物パイプライン・検知番人 — municipality_profiles の各自治体営業先が
lib/tracks/govOutreach.ts の11段トラックのどこにいるかを判定し、
「次にAIがやるべき作業」をキューにして work/proposal_queue_watch.json に書き出す。

【重要】lib/tracks/govOutreach.ts に同じ判定ロジックのTypeScript実装がある。
片方だけ直すと番人の検知結果と画面表示がずれるので、必ず両方を同時に直すこと
（lib/leadTemperature.ts ↔ agents/lead_temperature.py と同じ既存の割り切り）。

この番人はAI APIを一切呼ばず、Supabase REST の読み取りのみを行う。DBへの書き込みもしない。
実際にAIを呼んで成果物を作るのは agents/autopilot.py（この番人の出力を読むだけの別プロセス）。
"""
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone

import common

STUCK_DAYS = 14  # 同じ段で何日動かなければ「詰まっている」とみなすか

# lib/tracks/govOutreach.ts の GOV_OUTREACH_TRACK と対応する判定。
# 各要素: (id, label, owner, kind or None)
TRACK = [
    ("M1", "調査", "ai", "evidence"),
    ("M2", "宛先確保", "ai", "contact"),
    ("M3", "提案メール下書き", "ai", "email_draft"),
    ("M4", "事実確認", "chairman", None),
    ("M5", "初回送信", "chairman", None),
    ("M6", "反応・フォロー", "ai", "followup_draft"),
    ("M7", "ヒアリング面談", "chairman", None),
    ("M8", "要件メモ", "ai", "requirements"),
    ("M9", "MVPデモ提示", "ai", "mvp_content"),
    ("M10", "見積提出", "chairman", "quote_research"),
    ("M11", "契約", "chairman", None),
]


def _filled(v) -> bool:
    return isinstance(v, str) and v.strip() != ""


def _done(idx: int, row: dict) -> bool:
    mid = TRACK[idx][0]
    if mid == "M1":
        return _filled(row.get("evidence_summary"))
    if mid == "M2":
        return _filled(row.get("contact_email"))
    if mid == "M3":
        return _filled(row.get("email_draft"))
    if mid == "M4":
        return row.get("fact_check_status") == "verified"
    if mid == "M5":
        return _filled(row.get("email_sent_at"))
    if mid == "M6":
        return _filled(row.get("email_reply"))
    if mid == "M7":
        return _filled(row.get("hearing_at"))
    if mid == "M8":
        return _filled(row.get("requirements_memo"))
    if mid == "M9":
        return _filled(row.get("mvp_shown_at"))
    if mid == "M10":
        return _filled(row.get("quoted_at"))
    return False  # M11(契約)は business_cases 側の管轄。ここでは常に未達扱い。


def _days_since(iso: str, now: datetime) -> int:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (now - dt).days
    except Exception:
        return 0


def derive(row: dict, now: datetime) -> dict:
    """1行(自治体)の現在地と次の一手を返す。lib/tracks/govOutreach.ts の deriveMilestone() と対応。"""
    if row.get("on_hold"):
        return {"reached": 0, "milestone": None, "owner": None, "kind": None, "reason": "保留中"}

    reached = 0
    while reached < len(TRACK) and _done(reached, row):
        reached += 1
    if reached >= len(TRACK):
        return {"reached": reached, "milestone": None, "owner": None, "kind": None, "reason": "完了"}

    mid, label, owner, kind = TRACK[reached]

    # M6(反応待ち)は二値でなく経過日数で手番が変わる。lib/followUp.ts の日数バンド(4/9日)に合わせる。
    if mid == "M6":
        sent_at = row.get("email_sent_at")
        if sent_at:
            anchor = row.get("followed_up_at") or sent_at
            days = _days_since(anchor, now)
            if days > 4:
                return {"reached": reached, "milestone": mid, "owner": "ai", "kind": "followup_draft",
                        "reason": f"フォロー文案を作る（{days}日経過）"}
            return {"reached": reached, "milestone": mid, "owner": "chairman", "kind": None,
                    "reason": f"送信{days}日目・反応待ち"}

    # 返信が届いていてまだ会長が捌いていないなら、返答案を作るのが最優先。
    if _filled(row.get("email_reply")) and not _filled(row.get("reply_handled_at")):
        return {"reached": reached, "milestone": mid, "owner": "ai", "kind": "reply_draft",
                "reason": "届いた返信への返答案を作る"}

    if owner == "ai" and kind:
        return {"reached": reached, "milestone": mid, "owner": "ai", "kind": kind, "reason": f"{label}を作る"}
    return {"reached": reached, "milestone": mid, "owner": "chairman", "kind": None, "reason": f"{label}（会長の手番）"}


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read())


def _get_tolerant(url: str, key: str, path: str, max_retries: int = 20) -> list:
    """_get のカラム欠落に強い版。マイグレーションが手動適用のため、コードが期待する
    カラムがまだ本番に無いことがある（app/api/admin/*/route.ts の再試行ループと同じ考え方）。
    PostgRESTの「column does not exist」(42703)を検知したら、そのカラムを select= から
    外して再試行する。呼び出し元は結果に該当キーが無いことを row.get() で吸収すること。"""
    current = path
    for _ in range(max_retries):
        try:
            return _get(url, key, current)
        except urllib.error.HTTPError as e:
            if e.code != 400:
                raise
            body = e.read().decode("utf-8", errors="ignore")
            try:
                detail = json.loads(body)
            except json.JSONDecodeError:
                raise
            if detail.get("code") != "42703":
                raise
            missing = re.search(r'column ["\w.]*\.(\w+) does not exist', detail.get("message") or "")
            missing = missing.group(1) if missing else None
            if not missing:
                raise
            # select=a,b,c の中から欠落カラムだけを取り除く（先頭の select=... 部分にのみ手を入れる）
            new_path, n = re.subn(rf'(?<=[,=]){re.escape(missing)}(?=[,&]|$)', '', current)
            new_path = new_path.replace(',,', ',').replace('select=,', 'select=').replace(',&', '&')
            if n == 0 or new_path == current:
                raise
            current = new_path
    raise RuntimeError(f"カラム欠落の再試行が上限({max_retries}回)に達しました: {path}")


def main():
    with common.running("proposal_queue_watch"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("proposal_queue_watch", {"error": "Supabase設定(.env.local)が見つかりません"})
            return

        try:
            rows = _get_tolerant(
                url, key,
                "municipality_profiles?select=id,region_name,is_priority_pick,opportunity_level,on_hold,"
                "evidence_summary,contact_email,email_draft,fact_check_status,email_sent_at,email_reply,"
                "followed_up_at,reply_handled_at,hearing_at,requirements_memo,mvp_shown_at,quoted_at,updated_at"
                "&linked_biz_model_idea_id=not.is.null",
            )
        except Exception as e:
            common.write_result("proposal_queue_watch", {"error": f"Supabase取得エラー: {e}"})
            return

        # fact_check_watch.py（毎朝08:10・この番人より先に実行）が「出典と食い違う可能性」を
        # 見つけた行を読む。fact_check_watchはfact_check_statusを自動で書き換えないので、
        # ここでも自動でverified/flaggedにはしない。会長の目に留まりやすくするための表示用フラグ。
        fact_check_result = common.read_result("fact_check_watch") or {}
        needs_review_ids = {r["id"] for r in (fact_check_result.get("needs_review") or [])}

        # すでに提案中(revise含む)の成果物がある対象は二重生成させない。
        try:
            pending = _get(
                url, key,
                "ai_deliverables?select=entity_id,status&entity_type=eq.municipality_profile"
                "&status=in.(proposed,revise)",
            )
            pending_by_entity = {}
            for p in pending:
                pending_by_entity.setdefault(p["entity_id"], []).append(p["status"])
        except Exception:
            # ai_deliverables 未作成（マイグレーション未適用）でも本業を止めない。
            pending_by_entity = {}

        now = datetime.now(timezone.utc)
        by_milestone: dict[str, int] = {}
        blocked_on_chairman = []
        ai_queue = []
        stuck = []

        for row in rows:
            d = derive(row, now)
            mid = d["milestone"] or ("完了" if d["reached"] >= len(TRACK) else "保留")
            by_milestone[mid] = by_milestone.get(mid, 0) + 1

            days_stuck = _days_since(row.get("updated_at") or "", now) if row.get("updated_at") else 0
            if days_stuck >= STUCK_DAYS and d["owner"] is not None:
                stuck.append({"id": row["id"], "region_name": row["region_name"], "milestone": d["milestone"], "days_stuck": days_stuck})

            if d["owner"] != "ai":
                if d["owner"] == "chairman":
                    entry = {"id": row["id"], "region_name": row["region_name"], "milestone": d["milestone"], "reason": d["reason"]}
                    if row["id"] in needs_review_ids:
                        entry["fact_check_flag"] = "出典と食い違う可能性あり（要目視確認）"
                    blocked_on_chairman.append(entry)
                continue

            statuses = pending_by_entity.get(row["id"], [])
            if "revise" in statuses:
                continue  # 差し戻し済みは autopilot が最優先で拾うので、ここで新規キュー化しない
            if "proposed" in statuses:
                continue  # 会長の確認待ちがすでにある

            ai_queue.append({
                "entity_type": "municipality_profile",
                "entity_id": row["id"],
                "region_name": row["region_name"],
                "milestone": d["milestone"],
                "kind": d["kind"],
                "reason": d["reason"],
                "is_priority_pick": bool(row.get("is_priority_pick")),
                "opportunity_level": row.get("opportunity_level"),
                "revise": False,
            })

        # 差し戻し済み(要作り直し)は最優先でキューの先頭に積む。
        revise_queue = []
        for entity_id, statuses in pending_by_entity.items():
            if "revise" in statuses:
                match = next((r for r in rows if r["id"] == entity_id), None)
                if match:
                    d = derive(match, now)
                    revise_queue.append({
                        "entity_type": "municipality_profile",
                        "entity_id": entity_id, "region_name": match["region_name"],
                        "milestone": d["milestone"], "kind": d["kind"] or "email_draft",
                        "reason": "会長の差し戻し・作り直し", "is_priority_pick": bool(match.get("is_priority_pick")),
                        "opportunity_level": match.get("opportunity_level"), "revise": True,
                    })

        ai_queue.sort(key=lambda x: (not x["is_priority_pick"], x["opportunity_level"] != "高"))

        # 新規事業の仮説（entity_type='new_biz'）とSNS投稿案（entity_type='sns'）は、
        # 特定の自治体・リードに紐づかない「対象なし」の提案（entity_id=None）。
        # 営業トラック（自治体11件）を差し置いてまで毎日作らせると会長のチェックが埋もれるので、
        # 直近3日以内に同じ種類の提案（どのstatusでも）が無いときだけ1件キューに積む。
        # 憲法の「新しい仕組みより既存の送信可能案件を先に」の精神に沿って、営業キューの後ろに置く。
        GENERATIVE_COOLDOWN_DAYS = 3
        generative_queue = []
        for entity_type, kind, reason in [
            ("new_biz", "biz_hypothesis", "新規事業の仮説をひとつ作る"),
            ("sns", "sns_post", "SNS投稿案をひとつ作る"),
        ]:
            try:
                recent = _get(
                    url, key,
                    f"ai_deliverables?select=created_at&entity_type=eq.{entity_type}&kind=eq.{kind}"
                    "&order=created_at.desc&limit=1",
                )
            except Exception:
                recent = []  # ai_deliverables未作成でも本業を止めない
            if recent and _days_since(recent[0]["created_at"], now) < GENERATIVE_COOLDOWN_DAYS:
                continue
            generative_queue.append({
                "entity_type": entity_type, "entity_id": None, "region_name": None,
                "milestone": None, "kind": kind, "reason": reason,
                "is_priority_pick": False, "opportunity_level": None, "revise": False,
            })

        full_queue = revise_queue + ai_queue + generative_queue

        fact_check_flags = [
            {"id": r["id"], "region_name": r["region_name"], "missing_claims": r.get("missing_claims")}
            for r in (fact_check_result.get("needs_review") or [])
        ]

        common.write_result("proposal_queue_watch", {
            "checked": len(rows),
            "by_milestone": by_milestone,
            "blocked_on_chairman": blocked_on_chairman,
            "ai_queue": full_queue,
            "stuck": stuck,
            "fact_check_flags": fact_check_flags,
            "note": "AI APIは呼ばず、DBへの書き込みも行わない読み取り専用の番人。実際の生成は agents/autopilot.py が担当する。"
                    " fact_check_flagsはfact_check_watch.pyの結果をそのまま転記したもの（自動でverified/flaggedにはしない）。",
        })


if __name__ == "__main__":
    main()
