'use client';

// サイト設定タブ：トップページの大見出し・説明文・ボタン文言と、お知らせ帯を編集する。
// 非エンジニア（会長）が迷わないよう、専門用語を避けて「どこに出る文言か」を日本語で示し、
// 保存すると実サイトプレビューが自動で更新される（LivePreviewはページ編集タブと共通）。
import { useEffect, useState } from 'react';
import LivePreview from './LivePreview';
import LineSettingsSection from './LineSettingsSection';
import TeamMembersSection from './TeamMembersSection';
import SalesTargetSection from './SalesTargetSection';
import type { SiteSettings } from '@/lib/siteSettings';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid #ddd', fontSize: 14, fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', margin: '16px 0 6px', display: 'block' };
const hintStyle: React.CSSProperties = { fontSize: 11, color: '#999', margin: '4px 0 0' };

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
      <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{title}</p>
      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#999' }}>{desc}</p>
      {children}
    </div>
  );
}

export default function SettingsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [defaults, setDefaults] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [previewVersion, setPreviewVersion] = useState(0);
  const [demoData, setDemoData] = useState<{ exists: boolean; enabled: boolean; totalCount: number } | null>(null);
  const [demoToggling, setDemoToggling] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setSettings(d.settings); setDefaults(d.defaults); }
        else if (typeof d.error === 'string' && d.error.includes('site_settings')) {
          // テーブル未作成（マイグレーション未適用）の場合は、専門用語を避けた準備手順を出す
          setMessage('このタブを使うには、データベースの準備が一度だけ必要です。開発担当（AI）に「site_settingsのマイグレーションを適用して」と伝えるか、SupabaseのSQL Editorで supabase/migrations/20260807_add_site_settings.sql を実行してください。');
        }
        else setMessage(d.error ?? '読み込みに失敗しました');
      })
      .catch(() => setMessage('通信エラー'))
      .finally(() => setLoading(false));
    fetch('/api/admin/demo-data', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setDemoData({ exists: d.exists, enabled: d.enabled, totalCount: d.totalCount }); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleDemoData(nextEnabled: boolean) {
    setDemoToggling(true);
    try {
      const res = await fetch('/api/admin/demo-data', {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json();
      if (data.ok) setDemoData(d => d ? { ...d, enabled: data.enabled } : d);
    } finally {
      setDemoToggling(false);
    }
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hero: {
            ...settings.hero,
            // 空行は保存前に取り除く（見出しに空行が混ざるのを防ぐ）
            headline_lines: settings.hero.headline_lines.filter(l => l.trim() !== ''),
          },
          announcement: settings.announcement,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSettings(data.settings);
        setMessage('保存しました。サイトに反映済みです（下のプレビューでも確認できます）。');
        setPreviewVersion(v => v + 1);
      } else setMessage(data.error ?? '保存に失敗しました');
    } catch {
      setMessage('通信エラー');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;
  if (!settings) return <p style={{ color: '#E74C3C' }}>{message || '読み込みに失敗しました'}</p>;

  const hero = settings.hero;
  const ann = settings.announcement;
  const setHero = (patch: Partial<typeof hero>) => setSettings({ ...settings, hero: { ...hero, ...patch } });
  const setAnn = (patch: Partial<typeof ann>) => setSettings({ ...settings, announcement: { ...ann, ...patch } });

  return (
    <div>
      <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px', lineHeight: 1.8 }}>
        トップページのいちばん目立つ部分（大見出し・説明文・ボタン）と、ページ最上部のお知らせ帯を編集できます。
        書き換えて「保存する」を押すだけで、サイトに反映されます（プログラムの知識は不要です）。
      </p>

      {/* お知らせ帯 */}
      <Card title="📢 お知らせ帯" desc="トップページのいちばん上に出る、緑色の帯です。イベント告知などに使えます。">
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={ann.enabled} onChange={e => setAnn({ enabled: e.target.checked })} />
          お知らせ帯を表示する
        </label>
        <label style={labelStyle}>お知らせの文言</label>
        <input value={ann.text} onChange={e => setAnn({ text: e.target.value })} style={inputStyle}
          placeholder="例：7/20（土）佐野市でまちあるきイベントを開催します" />
        <label style={labelStyle}>タップした時のリンク先（任意）</label>
        <input value={ann.href} onChange={e => setAnn({ href: e.target.value })} style={inputStyle}
          placeholder="例：/routes （空欄なら文字だけの帯になります）" />
      </Card>

      {/* トップの顔 */}
      <Card title="🏡 トップページの大見出しまわり" desc="サイトを開いて最初に目に入る部分です。">
        <label style={labelStyle}>小さな英字ラベル（大見出しの上）</label>
        <input value={hero.eyebrow} onChange={e => setHero({ eyebrow: e.target.value })} style={inputStyle} />

        <label style={labelStyle}>大見出し（1行ずつ・最大3行）</label>
        {[0, 1, 2].map(i => (
          <input
            key={i}
            value={hero.headline_lines[i] ?? ''}
            onChange={e => {
              const lines = [...hero.headline_lines];
              lines[i] = e.target.value;
              setHero({ headline_lines: lines });
            }}
            style={{ ...inputStyle, marginBottom: 6 }}
            placeholder={i === 0 ? '例：その色あせも、' : i === 1 ? '例：誰かが生きた証です。' : '（3行目・任意）'}
          />
        ))}
        <p style={hintStyle}>空欄の行は表示されません。全部空欄にすると元の文言に戻ります。</p>

        <label style={labelStyle}>説明文（大見出しの下）</label>
        <textarea rows={4} value={hero.subcopy} onChange={e => setHero({ subcopy: e.target.value })}
          style={{ ...inputStyle, lineHeight: 1.8, resize: 'vertical' }} />

        <label style={labelStyle}>メインボタンの文言</label>
        <input value={hero.cta_label} onChange={e => setHero({ cta_label: e.target.value })} style={inputStyle} />
        <label style={labelStyle}>メインボタンの行き先</label>
        <input value={hero.cta_href} onChange={e => setHero({ cta_href: e.target.value })} style={inputStyle} placeholder="/start" />
        <p style={hintStyle}>行き先は「/start」のように、サイト内のページの住所を入れます。迷ったら変えないでください。</p>

        <label style={labelStyle}>ボタン横の小さなリンク（文言）</label>
        <input value={hero.sub_link_label} onChange={e => setHero({ sub_link_label: e.target.value })} style={inputStyle} />
        <label style={labelStyle}>ボタン横の小さなリンク（行き先）</label>
        <input value={hero.sub_link_href} onChange={e => setHero({ sub_link_href: e.target.value })} style={inputStyle} />

        <label style={labelStyle}>ボタンの下の一言</label>
        <input value={hero.note} onChange={e => setHero({ note: e.target.value })} style={inputStyle} />

        <label style={labelStyle}>法人・自治体向けリンク（文言）</label>
        <input value={hero.biz_link_label} onChange={e => setHero({ biz_link_label: e.target.value })} style={inputStyle} />
        <label style={labelStyle}>法人・自治体向けリンク（行き先）</label>
        <input value={hero.biz_link_href} onChange={e => setHero({ biz_link_href: e.target.value })} style={inputStyle} />
      </Card>

      {demoData?.exists && (
        <Card title="🎭 営業デモ用データ" desc="商談用に投入した架空の投稿です。普段はオフのままにしてください。">
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '4px 0 0' }}>
            <input
              type="checkbox"
              checked={demoData.enabled}
              disabled={demoToggling}
              onChange={e => toggleDemoData(e.target.checked)}
            />
            公開マップ・自治体向けダッシュボードに反映する（{demoData.totalCount}件）
          </label>
          <p style={hintStyle}>
            商談の直前だけオンにし、終わったらすぐオフに戻してください。オフの間は運営（このダッシュボード）以外の誰にも見えません。
          </p>
        </Card>
      )}

      {message && <p style={{ fontSize: 13, color: '#566246', fontWeight: 700 }}>{message}</p>}

      <div style={{ display: 'flex', gap: 10, margin: '4px 0 20px' }}>
        <button onClick={save} disabled={saving} style={{
          flex: 1, padding: '13px 0', borderRadius: 8, border: 'none',
          background: '#23231F', color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: saving ? 'wait' : 'pointer',
        }}>{saving ? '保存中…' : '保存する'}</button>
        {defaults && (
          <button
            onClick={() => { if (window.confirm('すべての文言を最初の状態に戻します。よろしいですか？（「保存する」を押すまでサイトには反映されません）')) setSettings(defaults); }}
            style={{
              padding: '13px 18px', borderRadius: 8, border: '1px solid #ddd',
              background: '#fff', color: '#888', cursor: 'pointer', fontSize: 13,
            }}>元の文言に戻す</button>
        )}
      </div>

      <LivePreview path="/" version={previewVersion} />

      {/* 運営メンバー名簿。To-Doの担当・カレンダーの予定担当者として選べる実名リスト。
          メンバーが増減してもここから追加・編集するだけでよく、コードを直す必要はない。 */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #eee' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>👥 運営メンバー</h2>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
          To-Doの担当・カレンダーの予定担当者として選べる名簿です。「代表」に指定した1名が各一覧の先頭に表示されます。
        </p>
        <TeamMembersSection authHeaders={authHeaders} />
      </div>

      {/* 🎯 営業ノルマ（app_settings）。営業タブの「今日送る◯件」の目標値をここで変更する。 */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #eee' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>🎯 営業ノルマ</h2>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
          営業タブに表示する「今日送るべき件数」の目標値です。
        </p>
        <SalesTargetSection authHeaders={authHeaders} />
      </div>

      {/* LINE縁ミッションの設定（AIエージェント運営タブから移設）。
          CRUDではなく設定なので、他のサイト設定と同じこの画面にまとめる。 */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #eee' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>🐇 LINE縁ミッション</h2>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
          グループID・ミッションの間隔・自動投稿のON/OFFと名簿の設定です。ここでは投稿は行いません。
        </p>
        <LineSettingsSection authHeaders={authHeaders} />
      </div>
    </div>
  );
}
