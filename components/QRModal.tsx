'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  onClose: () => void;
  url?: string;          // 未指定時はサイトのトップURL（従来どおり）
  title?: string;
  description?: string;
}

export default function QRModal({ onClose, url: fixedUrl, title, description }: Props) {
  const [url, setUrl] = useState(fixedUrl ?? '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!fixedUrl) setUrl(window.location.origin);
  }, [fixedUrl]);

  async function copyUrl() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
      }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#fff', borderRadius: 20, padding: '28px 24px',
        zIndex: 2001, width: 'min(320px, 90vw)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14,
          background: '#f0f0f0', border: 'none', borderRadius: '50%',
          width: 30, height: 30, cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>

        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>{title ?? 'QRコード'}</h2>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: '#aaa' }}>
          {description ?? 'スキャンしてアプリを開く'}
        </p>

        {url && (
          <div style={{
            display: 'inline-block', padding: 12,
            background: '#fff', borderRadius: 12,
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            <QRCodeSVG value={url} size={200} level="M" />
          </div>
        )}

        <p style={{
          margin: '16px 0 8px', fontSize: 11, color: '#bbb',
          wordBreak: 'break-all', lineHeight: 1.5,
        }}>{url}</p>

        <button onClick={copyUrl} style={{
          width: '100%', padding: '12px',
          background: copied ? '#38ADA9' : '#FF6B9D',
          color: '#fff', border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          transition: 'background 0.2s',
        }}>
          {copied ? '✓ コピーしました' : '🔗 URLをコピー'}
        </button>

        <p style={{ margin: '12px 0 0', fontSize: 11, color: '#ccc' }}>
          参加者にQRコードを見せてスキャンしてもらう
        </p>
      </div>
    </>
  );
}
