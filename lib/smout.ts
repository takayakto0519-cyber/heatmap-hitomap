// SMOUT（smout.jp）関連の純粋関数。SalesTab.tsx・RelationPopulationTab.tsxの両方から使う。

// 自治体名の表記ゆれ（「佐野市（栃木県・デジタル推進課）」⇄「佐野市（栃木県）」等）を吸収するため、
// 括弧書きを除いた市区町村・都道府県の芯の部分だけで部分一致させる
export function coreRegionName(name: string): string {
  return name.replace(/[（(].*$/, '').trim();
}

// SMOUTは地域ページのURLが内部IDベース（例: /areas/243/）で自治体名から直接組み立てられないため、
// Google検索経由でその地域のSMOUTページに辿り着けるようにする（存在しないリンクを作らないための代替）
export function smoutSearchUrl(name: string): string {
  const core = coreRegionName(name);
  return `https://www.google.com/search?q=${encodeURIComponent(`site:smout.jp ${core}`)}`;
}
