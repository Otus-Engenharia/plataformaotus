import React, { useState } from 'react';
import axios from 'axios';

export default function InlineDilatacaoInput({ parcelaId, currentValue, onChanged }) {
  const [value, setValue] = useState(currentValue || 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const numValue = Number(value) || 0;
    if (numValue === (currentValue || 0)) return;

    setSaving(true);
    try {
      const { data } = await axios.patch(`/api/pagamentos/parcelas/${parcelaId}/dilatacao`, {
        dilatacao_dias: numValue,
      });
      if (data.success && onChanged) {
        onChanged(data.data);
      }
    } catch (err) {
      console.error('Erro ao salvar dilatacao:', err);
      setValue(currentValue || 0);
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="number"
      min="0"
      max="365"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
      disabled={saving}
      style={{
        width: '50px',
        padding: '2px 4px',
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        fontSize: '12px',
        textAlign: 'center',
        background: saving ? '#f3f4f6' : '#fff',
        fontFamily: 'Verdana, sans-serif',
      }}
      title="Dias de dilatacao do prazo de pagamento"
    />
  );
}
