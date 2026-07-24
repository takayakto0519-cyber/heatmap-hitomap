'use client';

// 🎯 営業ノルマ（app_settings.sales_targets）の編集。営業タブの「今日送る◯件」の
// 目標件数をここで変更できるようにする。site_settings（サイトの顔）とは別テーブルなので、
// 保存してもサイトの再生成（revalidate）は走らない。
import { useEffect, useState } from 'react';
import { DEFAULT_SALES_TARGETS } from '@/lib/appSettings';

const inputStyle: React.CSSProperties = {
  padding: '8px 11px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 14, outline: 'none', fontFamily: 'inherit', width: 100,
};

export default function SalesTargetSection({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [dailySendTarget, setDailySendTarget] = useState(DEFAULT_SALES_TARGETS.dailySendTarget);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/sales-settings', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setDailySendTarget(d.settings.dailySendTarget); })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/sales-settings', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ dailySendTarget }),
      });
      const data = await res.json();
      if (data.ok) { setMessage('保存しました'); setTimeout(() => setMessage(''), 2000); }
      else setMessage(data.error ?? '保存に失敗しました');
    } catch {
      setMessage('通信エラー');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ fontSize: 12, color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>
        1日に送るメールの目標件数
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number" min={1} value={dailySendTarget}
          onChange={e => setDailySendTarget(Number(e.target.value))}
          style={inputStyle}
        />
        <span style={{ fontSize: 12, color: '#999' }}>件/日</span>
        <button onClick={save} disabled={saving} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', background: '#38ADA9',
          color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
        }}>{saving ? '保存中…' : '保存する'}</button>
        {message && <span style={{ fontSize: 11.5, color: message === '保存しました' ? '#27AE60' : '#E74C3C' }}>{message}</span>}
      </div>
      <p style={{ fontSize: 11, color: '#999', margin: '6px 0 0' }}>
        営業タブの「🎯今日送る◯件」の目標値です。宛先確度・事実確認の両方が済んでいる下書きの中から、この件数までを一覧に出します。
      </p>
    </div>
  );
}
