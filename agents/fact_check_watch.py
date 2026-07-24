"""営業メール下書きファクトチェック一次スクリーニングAI — evidence_summary/email_draft の
具体的な数字・固有名詞が source_links の実ページに書かれているかを機械的に突き合わせる。
LLM APIは使わず、Supabase REST読み取り＋各source_linkのHTML取得＋正規表現の文字列突合のみ。

【この番人の役割の限界（重要）】
これは「怪しい行を人間・AIエージェントの目に上げる」ための一次スクリーニングであり、
fact_check_status を自動で 'verified' にすることは絶対にしない。
逆に自動で 'flagged' にもしない — 2026-07-22に「瀬戸内ワークス」「e-加賀市民制度」が
出典ページの取得不足だけで誤って捏造疑いと判定された事故があったため、
機械的な不一致＝捏造とは限らない（JS動的レンダリング・別ページに記載・表記ゆれ等）。
このスクリプトは work/fact_check_watch.json に「要確認」候補を書き出すだけで、
実際に fact_check_status を verified/flagged にするのは、会長がダッシュボードで
「事実確認済みにする」を押すか、AIエージェントが出典を直接読んで判断した時のみ。

対象は municipality_profiles のみ（client_leads / sales_email_targets には
evidence_summary・source_links 相当のカラムがまだ無いため、この番人ではカバーできない）。
"""
import json
import re
import urllib.request
from html.parser import HTMLParser

import common

MAX_ROWS = 40  # 1回の実行で確認する上限（クロール負荷・実行時間の制御）
FETCH_TIMEOUT = 12

NUMBER_CLAIM_RE = re.compile(r"\d{1,4}(?:年連続|年度|年|人|件|万人|万円|億円|万|億|円|％|%|歳|回)")
QUOTED_NAME_RE = re.compile(r"「([^」]{2,20})」")


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.chunks = []

    def handle_data(self, data):
        self.chunks.append(data)

    def text(self) -> str:
        return " ".join(self.chunks)


def _fetch_text(url: str) -> str | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; HitomapFactCheckBot/1.0)"})
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as res:
            raw = res.read().decode("utf-8", errors="ignore")
        parser = _TextExtractor()
        parser.feed(raw)
        return re.sub(r"\s+", "", parser.text())
    except Exception:
        return None


def _extract_claims(text: str) -> list[str]:
    if not text:
        return []
    claims = set(NUMBER_CLAIM_RE.findall(text))
    claims |= set(QUOTED_NAME_RE.findall(text))
    return sorted(claims)


def _get(url: str, key: str, path: str) -> list:
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read())


def _sync_flags_to_db(url: str, key: str, needs_review: list) -> None:
    """work/fact_check_watch.jsonへのローカル書き出しに加え、fact_check_flagsテーブルへも反映する。
    本番（Vercel等）はこのPCのローカルファイルを読めないため、ダッシュボードはこのテーブルだけを見る。
    fact_check_status自体はここでも一切変更しない（読み取り専用の指摘テーブル）。
    対象はmunicipality_profilesのみ。既存のkind=municipalityの行を全置換する単純な設計。
    """
    headers_common = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/fact_check_flags?kind=eq.municipality",
            headers=headers_common, method="DELETE",
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        return  # テーブル未作成（マイグレーション未適用）等。ローカルJSON書き出しには影響させない。

    if not needs_review:
        return

    rows = [
        {
            "profile_id": item["id"],
            "kind": "municipality",
            "claim": "・".join(item["missing_claims"]),
            "reason": item["note"],
        }
        for item in needs_review
    ]
    try:
        body = json.dumps(rows).encode("utf-8")
        req = urllib.request.Request(
            f"{url}/rest/v1/fact_check_flags",
            data=body, headers={**headers_common, "Prefer": "return=minimal"}, method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


def main():
    with common.running("fact_check_watch"):
        env = common.load_env_local()
        url = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if not url or not key:
            common.write_result("fact_check_watch", {"error": "Supabase設定(.env.local)が見つかりません"})
            return

        try:
            rows = _get(
                url, key,
                "municipality_profiles?select=id,region_name,evidence_summary,source_links,fact_check_status"
                "&fact_check_status=eq.unverified&evidence_summary=not.is.null&source_links=not.is.null"
                f"&order=region_name.asc&limit={MAX_ROWS}",
            )
        except Exception as e:
            common.write_result("fact_check_watch", {"error": f"Supabase取得エラー: {e}"})
            return

        needs_review = []
        clean = []
        fetch_failed = []
        pdf_only_skipped = []

        for row in rows:
            claims = _extract_claims(row.get("evidence_summary") or "")
            if not claims:
                continue  # 具体的な数字・固有名詞が無い＝突合しようがないのでスキップ（要確認扱いにしない）

            all_links = [u.strip() for u in re.split(r"[;,\s]+", row.get("source_links") or "") if u.strip().startswith("http")]
            if not all_links:
                continue
            # PDFはHTMLパーサーでは正しくテキスト化できず「一致しない」ノイズを大量発生させるため、
            # 突合対象からは除外する（PDFのみの行は別枠で報告し、要確認リストを汚さない）。
            links = [u for u in all_links if not u.lower().endswith(".pdf")]
            if not links:
                pdf_only_skipped.append({"region_name": row["region_name"], "id": row["id"], "source_links": all_links})
                continue

            fetched_texts = [t for t in (_fetch_text(u) for u in links) if t]
            if not fetched_texts:
                fetch_failed.append({"region_name": row["region_name"], "id": row["id"]})
                continue

            combined = "".join(fetched_texts)
            missing = [c for c in claims if c not in combined]

            if missing:
                needs_review.append({
                    "id": row["id"],
                    "region_name": row["region_name"],
                    "missing_claims": missing,
                    "source_links": links,
                    "note": "出典ページの取得テキストに完全一致しない記述があります。表記ゆれ・別ページ掲載の可能性もあるため、必ず人間かAIエージェントが目視で出典を確認してからfact_check_statusを判断してください。",
                })
            else:
                clean.append({"id": row["id"], "region_name": row["region_name"]})

        _sync_flags_to_db(url, key, needs_review)

        common.write_result("fact_check_watch", {
            "checked": len(rows),
            "needs_review_count": len(needs_review),
            "needs_review": needs_review,
            "clean_count": len(clean),
            "fetch_failed_count": len(fetch_failed),
            "fetch_failed": fetch_failed,
            "pdf_only_skipped_count": len(pdf_only_skipped),
            "pdf_only_skipped": pdf_only_skipped,
            "note": "fact_check_statusの自動変更は行いません。needs_reviewに挙がった行を優先的に会長/AIエージェントが確認してください。pdf_only_skippedはPDF出典のみでこの番人では自動チェックできない行です（人間かAIエージェントによる目視確認が必要）。",
        })


if __name__ == "__main__":
    main()
