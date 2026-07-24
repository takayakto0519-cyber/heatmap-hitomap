"""AI成果物パイプライン・検知番人 — 営業（municipality_profiles）・新規事業開発
（biz_model_ideas）・マーケ（SNS投稿）それぞれの「次にAIがやるべき作業」をキューにして
work/proposal_queue_watch.json に書き出す。

【重要】営業トラックは lib/tracks/govOutreach.ts、新規事業トラックは lib/tracks/newBizDev.ts に
同じ判定ロジックのTypeScript実装がある。片方だけ直すと番人の検知結果と画面表示がずれるので、
必ず両方を同時に直すこと（lib/leadTemperature.ts ↔ agents/lead_temperature.py と同じ既存の割り切り）。

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


# lib/tracks/newBizDev.ts の NEW_BIZ_TRACK と対応する判定。仮説(NB1)はbiz_model_ideasの
# 行そのものが実体なのでここには含めない（対象なし提案として別枠で生成する）。
NB_TRACK = [
    ("NB2", "需要検証", "validation_research"),
    ("NB3", "MVP設計", "mvp_spec"),
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


def _newbiz_done(mid: str, idea: dict) -> bool:
    if mid == "NB2":
        return _filled(idea.get("validation_summary"))
    if mid == "NB3":
        return _filled(idea.get("mvp_spec_md"))
    return False


def derive_newbiz(idea: dict) -> dict | None:
    """1件の新規事業案(biz_model_ideas)の次の一手を返す（NB2→NB3の順、先頭から見て最初の未達）。
    完了済み(NB2・NB3とも埋まっている)ならNone。"""
    for mid, label, kind in NB_TRACK:
        if not _newbiz_done(mid, idea):
            return {"milestone": mid, "kind": kind, "reason": f"{label}を進める"}
    return None


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

        # 新規事業・マーケ・自治体M0(新規開拓)の差し戻しも同様に最優先で拾う。
        # こちらは自治体トラックのように次の一手を導出し直さず、差し戻された時と同じkindを
        # そのまま再生成する（改善点はfeedbackに入っているのでautopilot側がそれを読む）。
        # 自治体の既存11件の差し戻し（entity_idあり）は上のrevise_queueで別途処理済みなので、
        # ここは entity_id が無い(=対象なし提案)ものだけに絞る。
        try:
            other_revise = _get(
                url, key,
                "ai_deliverables?select=id,entity_id,entity_type,kind,title"
                "&entity_type=in.(new_biz,sns,municipality_profile)&status=eq.revise&entity_id=is.null",
            )
        except Exception:
            other_revise = []
        for r in other_revise:
            revise_queue.append({
                "entity_type": r["entity_type"], "entity_id": r.get("entity_id"), "region_name": r.get("title"),
                "milestone": None, "kind": r["kind"], "reason": "会長の差し戻し・作り直し",
                "is_priority_pick": False, "opportunity_level": None, "revise": True,
            })

        # 営業トラック（自治体11件）を差し置いてまで毎日作らせると会長のチェックが埋もれるので、
        # 新規事業・マーケの自動生成は控えめなペースにする。憲法の「新しい仕組みより
        # 既存の送信可能案件を先に」の精神に沿って、営業キューの後ろに積む。
        GENERATIVE_COOLDOWN_DAYS = 3
        generative_queue = []

        # --- 自治体営業M0（新規開拓）--- 既存11件の空欄埋めとは別に、週1件だけ新しい候補自治体を
        # 提案する（entity_type='municipality_profile', kind='new_target', entity_id=None）。
        # 承認されるとlib/deliverables.tsのCREATE_INでmunicipality_profilesに新規登録され、
        # 以降は既存のM1〜M11トラックにそのまま乗る。2026-07-24、会長の要望で追加。
        NEW_TARGET_COOLDOWN_DAYS = 7
        try:
            nt_pending = _get(
                url, key,
                "ai_deliverables?select=id&entity_type=eq.municipality_profile&kind=eq.new_target"
                "&status=in.(proposed,revise)",
            )
        except Exception:
            nt_pending = []
        try:
            nt_recent = _get(
                url, key,
                "ai_deliverables?select=created_at&entity_type=eq.municipality_profile&kind=eq.new_target"
                "&order=created_at.desc&limit=1",
            )
        except Exception:
            nt_recent = []
        nt_on_cooldown = nt_recent and _days_since(nt_recent[0]["created_at"], now) < NEW_TARGET_COOLDOWN_DAYS
        if not nt_pending and not nt_on_cooldown:
            generative_queue.append({
                "entity_type": "municipality_profile", "entity_id": None, "region_name": None,
                "milestone": "M0", "kind": "new_target", "reason": "新しい自治体候補をひとつ探す",
                "is_priority_pick": False, "opportunity_level": None, "revise": False,
            })

        # --- 新規事業（entity_type='new_biz'）---
        # NB1(仮説)は対象の行が無い提案として生まれ、承認された瞬間にbiz_model_ideasへ新規登録される
        # （lib/deliverables.tsのCREATE_IN）。NB2(需要検証)・NB3(MVP設計)はその行に対する追加提案。
        try:
            newbiz_pending = _get(
                url, key,
                "ai_deliverables?select=entity_id,status&entity_type=eq.new_biz&status=in.(proposed,revise)",
            )
            newbiz_pending_ids = {p["entity_id"] for p in newbiz_pending}  # entity_id=Noneも含む(NB1用)
        except Exception:
            newbiz_pending_ids = set()

        try:
            recent_hyp = _get(
                url, key,
                "ai_deliverables?select=created_at&entity_type=eq.new_biz&kind=eq.biz_hypothesis"
                "&order=created_at.desc&limit=1",
            )
        except Exception:
            recent_hyp = []
        hyp_on_cooldown = recent_hyp and _days_since(recent_hyp[0]["created_at"], now) < GENERATIVE_COOLDOWN_DAYS
        if None not in newbiz_pending_ids and not hyp_on_cooldown:
            generative_queue.append({
                "entity_type": "new_biz", "entity_id": None, "region_name": None,
                "milestone": "NB1", "kind": "biz_hypothesis", "reason": "新規事業の仮説をひとつ作る",
                "is_priority_pick": False, "opportunity_level": None, "revise": False,
            })

        try:
            ideas = _get_tolerant(
                url, key,
                "biz_model_ideas?select=id,title,status,validation_summary,mvp_spec_md"
                "&status=in.(idea,validating)",
            )
        except Exception:
            ideas = []
        for idea in ideas:
            if idea["id"] in newbiz_pending_ids:
                continue  # 会長の確認待ち・差し戻し済みは二重生成しない
            nb = derive_newbiz(idea)
            if nb:
                generative_queue.append({
                    "entity_type": "new_biz", "entity_id": idea["id"], "region_name": idea["title"],
                    "milestone": nb["milestone"], "kind": nb["kind"], "reason": nb["reason"],
                    "is_priority_pick": False, "opportunity_level": None, "revise": False,
                })

        # --- マーケ（entity_type='sns'）--- テーマ発案(content_theme) → 承認されたテーマを
        # 素材にSNS投稿案(sns_post)を作る、の2段。「何のためのテーマか」を素通りさせないため。
        try:
            latest_theme_rows = _get(
                url, key,
                "ai_deliverables?select=id,title,body,status,created_at,updated_at"
                "&entity_type=eq.sns&kind=eq.content_theme&order=created_at.desc&limit=1",
            )
        except Exception:
            latest_theme_rows = []
        latest_theme = latest_theme_rows[0] if latest_theme_rows else None

        try:
            latest_post_rows = _get(
                url, key,
                "ai_deliverables?select=created_at&entity_type=eq.sns&kind=eq.sns_post"
                "&order=created_at.desc&limit=1",
            )
        except Exception:
            latest_post_rows = []
        latest_post = latest_post_rows[0] if latest_post_rows else None

        if latest_theme is None:
            generative_queue.append({
                "entity_type": "sns", "entity_id": None, "region_name": None,
                "milestone": "MK1", "kind": "content_theme", "reason": "SNS企画テーマをひとつ考える",
                "is_priority_pick": False, "opportunity_level": None, "revise": False,
            })
        elif latest_theme["status"] in ("proposed", "revise"):
            pass  # 会長の確認待ち、または差し戻し済み（revise_queue側で別途最優先キュー化される）
        elif latest_theme["status"] == "archived":
            if _days_since(latest_theme["created_at"], now) >= GENERATIVE_COOLDOWN_DAYS:
                generative_queue.append({
                    "entity_type": "sns", "entity_id": None, "region_name": None,
                    "milestone": "MK1", "kind": "content_theme", "reason": "SNS企画テーマをひとつ考える（前回は却下）",
                    "is_priority_pick": False, "opportunity_level": None, "revise": False,
                })
        elif latest_theme["status"] == "approved":
            theme_used = bool(latest_post) and latest_post["created_at"] > latest_theme.get("updated_at", latest_theme["created_at"])
            if not theme_used:
                # entity_idはNoneのままにする（sns_postはCREATE_IN経由でsns_draftsに新規作成する
                # kindのため。ここにentity_idを入れるとlib/deliverables.tsのREFLECT_TO分岐に
                # 誤って入り、承認しても何も反映されなくなる）。テーマの内容はtheme_title/theme_body
                # として渡すだけにし、autopilotスキルが本文執筆時の材料として読む。
                generative_queue.append({
                    "entity_type": "sns", "entity_id": None, "region_name": None,
                    "milestone": "MK2", "kind": "sns_post", "reason": "承認済みテーマでSNS投稿案を作る",
                    "is_priority_pick": False, "opportunity_level": None, "revise": False,
                    "theme_title": latest_theme["title"], "theme_body": latest_theme["body"],
                })
            elif _days_since(latest_post["created_at"], now) >= GENERATIVE_COOLDOWN_DAYS:
                generative_queue.append({
                    "entity_type": "sns", "entity_id": None, "region_name": None,
                    "milestone": "MK1", "kind": "content_theme", "reason": "SNS企画テーマをひとつ考える",
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
