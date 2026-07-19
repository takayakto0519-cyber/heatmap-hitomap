// 管理画面の「専用レポート」表示用の軽量Markdownレンダラー。
// 依存追加を避けるため、実際に使われている記法（見出し#〜###・太字・リンク・箇条書き・
// チェックボックス・番号リスト・テーブル・水平線）だけをサポートする自作パーサー。
import { Fragment, type ReactNode } from 'react';

// 見出しレベル1（"# "）の直前にある "---" 区切りを境に、レポートを大ブロックへ分割する。
// 各ブロックが「通話メモの追加検討」「3C分析」のような1つの話題のまとまりになる。
export interface ReportSection {
  heading: string; // 見出し文字列（"# " を除いたテキスト）。先頭の概要部分は heading が空文字になる。
  raw: string; // このセクションの生Markdown（見出し行を含む）
}

export function splitTopLevelSections(markdown: string): ReportSection[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const sections: ReportSection[] = [];
  let current: string[] = [];
  let currentHeading = '';

  function flush() {
    const raw = current.join('\n').trim();
    if (raw) sections.push({ heading: currentHeading, raw });
    current = [];
  }

  for (const line of lines) {
    const h1Match = /^#\s+(.+)$/.exec(line);
    if (h1Match) {
      flush();
      currentHeading = h1Match[1].trim();
      current.push(line);
      continue;
    }
    if (line.trim() === '---' && current.length === 0) continue; // ブロック間の区切り線は捨てる
    current.push(line);
  }
  flush();

  if (sections.length === 0) return [{ heading: '', raw: markdown.trim() }];
  return sections;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // 太字(**text**)・リンク([text](url))・インラインコード(`code`) を順に処理する簡易トークナイザ
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(<a key={`${keyPrefix}-l${i}`} href={match[3]} target="_blank" rel="noreferrer" style={{ color: '#38ADA9' }}>{match[2]}</a>);
    } else if (match[4] !== undefined) {
      nodes.push(<code key={`${keyPrefix}-c${i}`} style={{ background: '#f3f3f3', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em' }}>{match[4]}</code>);
    }
    lastIndex = pattern.lastIndex;
    i += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(cell => cell.trim());
}

export function MarkdownLite({ text }: { text: string }): ReactNode {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let paragraphBuf: string[] = [];
  let i = 0;

  function flushParagraph(key: string) {
    if (paragraphBuf.length === 0) return;
    const joined = paragraphBuf.join(' ').trim();
    if (joined) blocks.push(<p key={key} style={{ margin: '0 0 10px', lineHeight: 1.7 }}>{renderInline(joined, key)}</p>);
    paragraphBuf = [];
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { flushParagraph(`p${i}`); i += 1; continue; }
    if (line.trim() === '---') { flushParagraph(`p${i}`); blocks.push(<hr key={`hr${i}`} style={{ border: 'none', borderTop: '1px solid #eee', margin: '16px 0' }} />); i += 1; continue; }

    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) { flushParagraph(`p${i}`); blocks.push(<h4 key={`h${i}`} style={{ fontSize: 13.5, fontWeight: 800, margin: '14px 0 6px', color: '#555' }}>{renderInline(h3[1], `h${i}`)}</h4>); i += 1; continue; }
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) { flushParagraph(`p${i}`); blocks.push(<h3 key={`h${i}`} style={{ fontSize: 15, fontWeight: 800, margin: '18px 0 8px' }}>{renderInline(h2[1], `h${i}`)}</h3>); i += 1; continue; }
    const h1 = /^#\s+(.+)$/.exec(line);
    if (h1) { flushParagraph(`p${i}`); blocks.push(<h2 key={`h${i}`} style={{ fontSize: 17, fontWeight: 900, margin: '0 0 10px' }}>{renderInline(h1[1], `h${i}`)}</h2>); i += 1; continue; }

    // テーブル: 現在行が "|" を含み、次行がセパレータ行の場合にテーブルとして処理
    if (line.includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      flushParagraph(`p${i}`);
      const headerCells = splitTableRow(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].includes('|') && lines[j].trim() !== '') {
        rows.push(splitTableRow(lines[j]));
        j += 1;
      }
      blocks.push(
        <div key={`tbl${i}`} style={{ overflowX: 'auto', margin: '8px 0 14px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr>{headerCells.map((c, ci) => (
                <th key={ci} style={{ textAlign: 'left', padding: '6px 10px', background: '#faf7f2', borderBottom: '2px solid #eee', whiteSpace: 'nowrap' }}>{renderInline(c, `th${i}-${ci}`)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => (
                  <td key={ci} style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}>{renderInline(c, `td${i}-${ri}-${ci}`)}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j;
      continue;
    }

    const checkbox = /^-\s+\[([ xX])\]\s+(.+)$/.exec(line);
    if (checkbox) {
      flushParagraph(`p${i}`);
      const checked = checkbox[1].toLowerCase() === 'x';
      const itemLines: ReactNode[] = [];
      let j = i;
      while (j < lines.length) {
        const m = /^-\s+\[([ xX])\]\s+(.+)$/.exec(lines[j]);
        if (!m) break;
        itemLines.push(
          <li key={j} style={{ listStyle: 'none', display: 'flex', gap: 6, alignItems: 'flex-start', margin: '3px 0' }}>
            <span>{m[1].toLowerCase() === 'x' ? '☑' : '☐'}</span>
            <span>{renderInline(m[2], `cb${j}`)}</span>
          </li>
        );
        j += 1;
      }
      blocks.push(<ul key={`cbl${i}`} style={{ margin: '0 0 10px', padding: 0 }}>{itemLines}</ul>);
      i = j;
      continue;
    }

    const listItem = /^[-・]\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph(`p${i}`);
      const items: ReactNode[] = [];
      let j = i;
      while (j < lines.length) {
        const m = /^[-・]\s+(.+)$/.exec(lines[j]);
        if (!m) break;
        items.push(<li key={j} style={{ margin: '3px 0' }}>{renderInline(m[1], `li${j}`)}</li>);
        j += 1;
      }
      blocks.push(<ul key={`ul${i}`} style={{ margin: '0 0 10px', paddingLeft: 20 }}>{items}</ul>);
      i = j;
      continue;
    }

    const numItem = /^\d+\.\s+(.+)$/.exec(line);
    if (numItem) {
      flushParagraph(`p${i}`);
      const items: ReactNode[] = [];
      let j = i;
      while (j < lines.length) {
        const m = /^\d+\.\s+(.+)$/.exec(lines[j]);
        if (!m) break;
        items.push(<li key={j} style={{ margin: '3px 0' }}>{renderInline(m[1], `ol${j}`)}</li>);
        j += 1;
      }
      blocks.push(<ol key={`ol${i}`} style={{ margin: '0 0 10px', paddingLeft: 20 }}>{items}</ol>);
      i = j;
      continue;
    }

    paragraphBuf.push(line);
    i += 1;
  }
  flushParagraph('p-last');

  return <Fragment>{blocks}</Fragment>;
}
