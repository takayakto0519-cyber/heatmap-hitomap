#!/usr/bin/env bash
# Windows Git Bash環境でSupabase REST APIをPATCHする際の3つの既知バグをまとめて回避するヘルパー。
# 2026-07-22までに繰り返し踏んだ事故:
#   1. curl -d に日本語を直接渡すとUTF-8が化ける → 必ずJSONファイル経由(--data-binary @file)にする
#   2. Windowsで書かれたidリストファイルはCRLF付きになり、末尾に\rが混入してURLが壊れる → tr -d '\r' で除去
#   3. 短い間隔で連続PATCHすると稀にcurlが接続を確立できず%{http_code}が000になる → 1回だけ自動リトライする
#
# 使い方:
#   bash scripts/supabase-patch.sh <table> <id> <path/to/patch.json>
#
# 環境変数（.env.localから自動取得、無ければエラー終了）:
#   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
set -euo pipefail

TABLE="${1:?table名を指定してください（例: municipality_profiles）}"
ID="${2:?idを指定してください}"
PATCH_FILE="${3:?patch.jsonのパスを指定してください}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "エラー: .env.localが見つかりません ($ENV_FILE)" >&2
  exit 1
fi

SUPA_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
SUPA_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')

if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
  echo "エラー: .env.localにNEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEYが見つかりません" >&2
  exit 1
fi

# idはCRLF・前後空白混入の可能性があるので必ず除去する（バグ2の対策）
ID_CLEAN=$(printf '%s' "$ID" | tr -d '\r\n' | xargs)

do_patch() {
  curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "${SUPA_URL}/rest/v1/${TABLE}?id=eq.${ID_CLEAN}" \
    -H "apikey: ${SUPA_KEY}" -H "Authorization: Bearer ${SUPA_KEY}" \
    -H "Content-Type: application/json" -H "Prefer: return=minimal" \
    --data-binary "@${PATCH_FILE}"
}

CODE=$(do_patch)
if [ "$CODE" = "000" ]; then
  # バグ3対策：接続確立失敗は1秒待って1回だけ自動リトライ
  sleep 1
  CODE=$(do_patch)
fi

echo "${TABLE}/${ID_CLEAN}: HTTP ${CODE}"
if [ "$CODE" != "200" ] && [ "$CODE" != "204" ]; then
  exit 1
fi
