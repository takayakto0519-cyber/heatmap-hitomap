'use client';

// スポンサー管理：協賛枠の作成・管理。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useState } from 'react';
import type { Sponsor } from '@/lib/types';
import { Card, inputStyle } from '@/components/admin/adminShared';

export default function SponsorsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ placement: 'region', region: '', name: '', message: '', url: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/sponsors', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setSponsors(d.sponsors); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createSponsor(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sponsors', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          placement: form.placement, region: form.region || null,
          name: form.name, message: form.message || null, url: form.url || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setForm({ placement: 'region', region: '', name: '', message: '', url: '' });
        setShowForm(false);
        load();
      } else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Sponsor) {
    const res = await fetch(`/api/admin/sponsors/${s.id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ is_active: !s.is_active }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function removeSponsor(id: string) {
    if (!confirm('このスポンサー枠を削除しますか？')) return;
    const res = await fetch(`/api/admin/sponsors/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  return (
    <div>
      <button onClick={() => setShowForm(v => !v)} style={{
        padding: '9px 16px', borderRadius: 8, border: 'none', marginBottom: 14,
        background: '#FF6B9D', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
      }}>{showForm ? '閉じる' : '＋ 新しいスポンサー枠を追加'}</button>

      {showForm && (
        <Card>
          <form onSubmit={createSponsor} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={form.placement} onChange={e => setForm(f => ({ ...f, placement: e.target.value }))} style={inputStyle}>
              <option value="region">region（自治体ページ）</option>
              <option value="detour">detour（寄り道モード）</option>
            </select>
            <input placeholder="対象の自治体名（regionの場合）" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} style={inputStyle} />
            <input placeholder="スポンサー名 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} required />
            <input placeholder="メッセージ" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={inputStyle} />
            <input placeholder="リンクURL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} style={inputStyle} />
            <button type="submit" disabled={saving} style={{
              padding: '9px 0', borderRadius: 8, border: 'none',
              background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
            }}>{saving ? '作成中…' : '作成する'}</button>
          </form>
        </Card>
      )}

      {error && <p style={{ color: '#E74C3C', fontSize: 13, marginTop: 10 }}>{error}</p>}
      {loading ? <p style={{ color: '#999', marginTop: 10 }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {sponsors.length === 0 && <p style={{ color: '#aaa' }}>登録されたスポンサー枠はありません。</p>}
          {sponsors.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff', borderRadius: 10, padding: '10px 12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', opacity: s.is_active ? 1 : 0.5,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{s.name}
                  <span style={{ fontWeight: 400, color: '#aaa', fontSize: 11 }}> ・ {s.placement}{s.region ? ` ・ ${s.region}` : ''}</span>
                </p>
                {s.message && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#666' }}>{s.message}</p>}
              </div>
              <button onClick={() => toggleActive(s)} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: s.is_active ? '#FFF3CD' : '#E8F8F7',
                color: s.is_active ? '#856404' : '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{s.is_active ? '停止する' : '再開する'}</button>
              <button onClick={() => removeSponsor(s.id)} style={{
                padding: '6px 10px', borderRadius: 8, border: 'none',
                background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
              }}>削除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

