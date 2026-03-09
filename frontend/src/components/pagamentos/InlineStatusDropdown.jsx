import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ParcelaStatusBadge from './ParcelaStatusBadge';

export default function InlineStatusDropdown({ parcelaId, field, currentStatus, statusOptions, onStatusChanged, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = async (value) => {
    if (value === currentStatus || saving) return;
    setSaving(true);
    setOpen(false);

    try {
      const { data } = await axios.patch(`/api/pagamentos/parcelas/${parcelaId}/status`, { field, value });
      if (data.success && onStatusChanged) {
        onStatusChanged(data.data);
      }
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    } finally {
      setSaving(false);
    }
  };

  const type = field === 'projetos' ? 'projetos' : 'financeiro';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => !disabled && !saving && setOpen(!open)}
        disabled={disabled || saving}
        style={{
          border: 'none',
          background: 'none',
          cursor: disabled ? 'default' : 'pointer',
          padding: 0,
          opacity: saving ? 0.6 : 1,
        }}
        title={disabled ? '' : 'Clique para alterar status'}
      >
        <ParcelaStatusBadge status={currentStatus} type={type} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 1000,
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: '180px',
          marginTop: '4px',
          padding: '4px 0',
        }}>
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                border: 'none',
                background: opt.value === currentStatus ? 'rgba(0,0,0,0.04)' : 'transparent',
                padding: '8px 12px',
                cursor: opt.value === currentStatus ? 'default' : 'pointer',
                fontSize: '13px',
                color: '#333',
                gap: '8px',
                textAlign: 'left',
              }}
              onMouseEnter={e => { if (opt.value !== currentStatus) e.target.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={e => { if (opt.value !== currentStatus) e.target.style.background = 'transparent'; }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: opt.color,
                flexShrink: 0,
              }} />
              <span>{opt.label}</span>
              {opt.value === currentStatus && (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#4caf50" style={{ marginLeft: 'auto' }}>
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
