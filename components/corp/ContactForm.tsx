'use client';

// /company/contact 用の問い合わせフォーム。/api/leads にPOSTし、client_leadsへ即時登録される。
// これまでmailtoリンクのみだったため、問い合わせが運営ダッシュボード「学校・法人」タブに
// 自動で載らず、手動転記に頼っていた。フォーム送信を主導線にし、メールは補助手段として残す。
import { useState } from 'react';
import { corpColor, corpFont } from '@/components/corp/tokens';

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '13px 14px',
  border: `1.5px solid ${corpColor.line}`, background: corpColor.white,
  fontSize: 14, fontFamily: corpFont.body, color: corpColor.ink, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: corpColor.inkSoft, marginBottom: 6, fontFamily: corpFont.body,
};

export default function ContactForm() {
  const [clientType, setClientType] = useState<'business' | 'school'>('business');
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [website, setWebsite] = useState(''); // ハニーポット（人には見えない）
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_type: clientType, org_name: orgName, contact_name: contactName,
          email, phone, memo, website,
        }),
      });
      const d = await res.json();
      if (!d.ok) { setError(d.error ?? '送信に失敗しました'); setState('error'); return; }
      setState('done');
    } catch {
      setError('通信エラーが発生しました');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div style={{ padding: '32px 24px', border: `1.5px solid ${corpColor.moss}`, background: corpColor.white, textAlign: 'center' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: corpColor.moss, fontFamily: corpFont.body }}>
          お問い合わせを受け付けました
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: corpColor.inkSoft, lineHeight: 1.8, fontFamily: corpFont.body }}>
          内容を確認のうえ、担当より折り返しご連絡いたします。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['business', 'school'] as const).map(t => (
          <button key={t} type="button" onClick={() => setClientType(t)} style={{
            flex: 1, padding: '10px 0', fontSize: 13, fontFamily: corpFont.body, cursor: 'pointer',
            border: `1.5px solid ${clientType === t ? corpColor.moss : corpColor.line}`,
            background: clientType === t ? corpColor.moss : corpColor.white,
            color: clientType === t ? corpColor.white : corpColor.inkSoft, fontWeight: 700,
          }}>{t === 'business' ? '法人・自治体' : '学校・教育機関'}</button>
        ))}
      </div>

      <div>
        <label style={labelStyle}>団体名・組織名 *</label>
        <input required value={orgName} onChange={e => setOrgName(e.target.value)} style={fieldStyle} placeholder="例：〇〇市役所 観光課" />
      </div>
      <div>
        <label style={labelStyle}>ご担当者名</label>
        <input value={contactName} onChange={e => setContactName(e.target.value)} style={fieldStyle} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>メールアドレス</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>電話番号</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} style={fieldStyle} />
        </div>
      </div>
      <p style={{ margin: '-8px 0 0', fontSize: 11, color: corpColor.inkSoft, fontFamily: corpFont.body }}>
        メールアドレス・電話番号のどちらかは必ずご入力ください。
      </p>
      <div>
        <label style={labelStyle}>ご相談内容</label>
        <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={5} style={{ ...fieldStyle, resize: 'vertical', fontFamily: corpFont.body }} placeholder="ご利用の目的・時期など、わかる範囲で構いません" />
      </div>

      {/* ハニーポット：CSSで隠すのみ（bot対策。人間の目には触れない） */}
      <input
        type="text" tabIndex={-1} autoComplete="off" value={website}
        onChange={e => setWebsite(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />

      {error && <p style={{ margin: 0, fontSize: 12.5, color: '#B23A2E', fontFamily: corpFont.body }}>{error}</p>}

      <button type="submit" disabled={state === 'sending'} className="hm-lift" style={{
        padding: '18px', background: corpColor.ink, textAlign: 'center', color: corpColor.white,
        fontWeight: 700, fontSize: 15, fontFamily: corpFont.body, border: 'none', cursor: 'pointer',
        letterSpacing: '0.05em', opacity: state === 'sending' ? 0.6 : 1,
      }}>{state === 'sending' ? '送信中…' : 'この内容で問い合わせる'}</button>
    </form>
  );
}
