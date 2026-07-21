// 全国市区町村の行政区域境界データ（GeoJSON）を取得し、リポジトリにキャッシュするスクリプト。
//
// データ源：smartnews-smri/japan-topography（国土数値情報 行政区域データ N03を
// GeoJSON化したもの、2021-09-28取得・商用利用無償・国交省ガイドラインに沿ったクレジット表記が必要）。
// https://github.com/smartnews-smri/japan-topography
//
// 特定コミットを固定して取得することで、再実行時の再現性を確保する（上流の更新に振り回されない）。
// 出力：
//   data/municipality-boundaries/{都道府県コード2桁}.json … 都道府県ごとの生FeatureCollection
//   public/data/municipalities-index.json … ジオメトリ抜きの軽量な市区町村一覧（運営UIの検索用）
//
// 実行頻度：年1回程度（行政区域が変わった時のみ再実行すればよい）。
// 使い方: node scripts/fetch-municipality-boundaries.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PINNED_SHA = 'b403e71eb97f1fdf32f63d16bd485129f703855e';
const BASE_URL = `https://raw.githubusercontent.com/smartnews-smri/japan-topography/${PINNED_SHA}/data/municipality/geojson/s0010`;

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, 'data', 'municipality-boundaries');
const INDEX_OUT = path.join(ROOT, 'public', 'data', 'municipalities-index.json');

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(path.dirname(INDEX_OUT), { recursive: true });

const index = [];

async function fetchPrefecture(prefCode) {
  const url = `${BASE_URL}/N03-21_${prefCode}_210101.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`取得失敗 ${url}: ${res.status}`);
  const geojson = await res.json();

  writeFileSync(path.join(OUT_DIR, `${prefCode}.json`), JSON.stringify(geojson));

  for (const f of geojson.features) {
    const p = f.properties;
    // N03_004が市区町村名。政令指定都市の行政区がN03_005に入るケースがあるため両方見る
    const name = p.N03_005 ? `${p.N03_004}${p.N03_005}` : p.N03_004;
    if (!p.N03_007 || !name) continue; // 郡など、市区町村コードを持たない行を除外
    index.push({ code: p.N03_007, name, pref: p.N03_001, prefCode });
  }
  console.log(`✓ ${prefCode}: ${geojson.features.length}件`);
}

async function main() {
  for (let i = 1; i <= 47; i++) {
    const prefCode = String(i).padStart(2, '0');
    await fetchPrefecture(prefCode);
  }
  // 表記ゆれ探索をしやすいよう、コード順に整列
  index.sort((a, b) => a.code.localeCompare(b.code));
  writeFileSync(INDEX_OUT, JSON.stringify(index));
  console.log(`\n完了：${index.length}市区町村。`);
  console.log(`出力: ${OUT_DIR}`);
  console.log(`出力: ${INDEX_OUT}`);
}

main().catch((err) => {
  console.error('失敗:', err.message);
  process.exit(1);
});
