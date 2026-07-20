// lib/agents/roster.ts（単一の真実の源）から agents/roster.generated.json を書き出す。
// Python側の番人（sync_status_to_supabase.py / agent-dashboard/server.py）がこのJSONを読む。
// roster.ts を手で編集したら、このスクリプトを実行してJSONを更新すること：
//   node scripts/export-agent-roster.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'lib', 'agents', 'roster.ts');
const OUT = path.join(ROOT, 'agents', 'roster.generated.json');

let ts = fs.readFileSync(SRC, 'utf-8');

// TS → JS：型宣言・interfaceを除去し、const の型注釈を落とす（roster.tsは純データなのでこれで足りる）
ts = ts
  .replace(/^export type .*$/gm, '')                       // export type ... ;
  .replace(/^export interface [\s\S]*?^\}/gm, '')           // export interface X { ... }
  .replace(/export const (\w+)\s*:\s*[^=]+=/g, 'export const $1 ='); // const NAME: T[] =

// 一時 .mjs に書いて動的importで評価
const tmp = path.join(ROOT, 'agents', '.roster.tmp.mjs');
fs.writeFileSync(tmp, ts);
try {
  const mod = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
  const data = {
    generated_from: 'lib/agents/roster.ts',
    floors: mod.FLOORS,
    scripts: mod.SCRIPTS,
    skills: mod.SKILLS,
    vacant: mod.VACANT,
  };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`wrote ${path.relative(ROOT, OUT)} — scripts:${mod.SCRIPTS.length} skills:${mod.SKILLS.length} vacant:${mod.VACANT.length}`);
} finally {
  fs.rmSync(tmp, { force: true });
}
