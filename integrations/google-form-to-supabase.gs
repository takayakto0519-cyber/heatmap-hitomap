/**
 * Googleフォーム → Supabase 中継スクリプト (Google Apps Script)
 * ------------------------------------------------------------
 * 使い方:
 *  1. Googleフォームの「スクリプトエディタ」にこのコードを貼る
 *  2. SUPABASE_URL / ANON_KEY を設定（スクリプトのプロパティ推奨）
 *  3. トリガー: フォーム送信時(onFormSubmit)に sendToSupabase を実行
 *
 * フォームの質問（順不同でOK・タイトル一致で拾う）:
 *  - タイトル / なぜ気になったか / どんな暮らしが見えたか
 *  - 自分の記憶・感情とどうつながったか
 *  - もう一度来たいか(はい/いいえ) / 誰かに話したいか(はい/いいえ)
 *  - 緯度 / 経度（フォーム冒頭で位置共有リンクから貼ってもらう or 後で付与）
 *  - 写真URL（Driveアップロード後のURL）/ ニックネーム
 * ------------------------------------------------------------
 */
function sendToSupabase(e) {
  const props = PropertiesService.getScriptProperties();
  const SUPABASE_URL = props.getProperty('SUPABASE_URL');     // 例: https://xxx.supabase.co
  const ANON_KEY = props.getProperty('SUPABASE_ANON_KEY');
  const SESSION_CODE = props.getProperty('SESSION_CODE') || 'ws-test';

  // 質問タイトル → 値 のマップを作る
  const answers = {};
  e.response.getItemResponses().forEach(function (ir) {
    answers[ir.getItem().getTitle().trim()] = ir.getResponse();
  });

  const toBool = (v) => v === 'はい' || v === 'true' || v === true;
  const toNum = (v) => (v === '' || v == null ? null : Number(v));

  const payload = {
    title: answers['タイトル'] || '(無題)',
    why: answers['なぜ気になったか'] || null,
    interpretation: answers['どんな暮らしが見えたか'] || null,
    self_reflection: answers['自分の記憶・感情とどうつながったか'] || null,
    want_revisit: toBool(answers['もう一度来たいか']),
    want_to_share: toBool(answers['誰かに話したいか']),
    latitude: toNum(answers['緯度']),
    longitude: toNum(answers['経度']),
    photo_url: answers['写真URL'] || null,
    nickname: answers['ニックネーム'] || null,
    session_code: SESSION_CODE,
  };

  // Supabase REST へ直接 insert（PostgREST）
  UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/traces', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: ANON_KEY,
      Authorization: 'Bearer ' + ANON_KEY,
      Prefer: 'return=minimal',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}
