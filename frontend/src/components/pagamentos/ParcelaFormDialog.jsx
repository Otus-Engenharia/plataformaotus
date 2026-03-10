import React, { useState, useEffect } from 'react';
import './ParcelaFormDialog.css';

const ORIGENS = ['Contrato', 'Aditivo'];

const TIPOS_SERVICO = [
  { value: 'coordenacao', label: 'Coordenacao' },
  { value: 'compatibilizacao', label: 'Compatibilizacao' },
  { value: 'modelagem', label: 'Modelagem' },
];

export default function ParcelaFormDialog({ open, onClose, onSave, onSaveBatch, parcela, projectCode, companyId, isAditivo = false, nextParcelaNumero = 1 }) {
  const isEdit = !!parcela;

  // Single edit form state
  const [form, setForm] = useState({
    parcela_numero: '',
    descricao: '',
    valor: '',
    origem: 'Contrato',
    tipo_servico: 'coordenacao',
    parcela_sem_cronograma: false,
  });

  // Batch creation state
  const [quantidade, setQuantidade] = useState(1);
  const [batchRows, setBatchRows] = useState([]);
  const [saving, setSaving] = useState(false);

  // Initialize batch rows
  useEffect(() => {
    if (!open || isEdit) return;
    const rows = Array.from({ length: quantidade }, (_, i) => ({
      parcela_numero: nextParcelaNumero + i,
      descricao: '',
      valor: '',
      origem: isAditivo ? 'Aditivo' : 'Contrato',
      tipo_servico: 'coordenacao',
      parcela_sem_cronograma: false,
    }));
    setBatchRows(rows);
  }, [quantidade, open, isEdit, nextParcelaNumero, isAditivo]);

  // Initialize edit form
  useEffect(() => {
    if (!open) return;
    if (parcela) {
      setForm({
        parcela_numero: parcela.parcela_numero || '',
        descricao: parcela.descricao || '',
        valor: parcela.valor || '',
        origem: parcela.origem || 'Contrato',
        tipo_servico: parcela.tipo_servico || 'coordenacao',
        parcela_sem_cronograma: parcela.parcela_sem_cronograma || false,
      });
    } else {
      setQuantidade(1);
    }
  }, [parcela, open]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBatchRowChange = (index, field, value) => {
    setBatchRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleQuantidadeChange = (val) => {
    const n = Math.max(1, Math.min(20, Number(val) || 1));
    setQuantidade(n);
  };

  // Edit mode submit
  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        parcela_numero: Number(form.parcela_numero),
        valor: form.valor ? Number(form.valor) : null,
        project_code: projectCode,
        company_id: companyId,
      });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar parcela:', err);
    } finally {
      setSaving(false);
    }
  };

  // Batch mode submit
  const handleSubmitBatch = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parcelas = batchRows.map(row => ({
        parcela_numero: Number(row.parcela_numero),
        descricao: row.descricao || null,
        valor: row.valor ? Number(row.valor) : null,
        origem: row.origem,
        tipo_servico: row.tipo_servico,
        parcela_sem_cronograma: row.parcela_sem_cronograma,
      }));
      if (onSaveBatch) {
        await onSaveBatch(parcelas);
      } else {
        // Fallback: create one by one via onSave
        for (const p of parcelas) {
          await onSave({ ...p, project_code: projectCode, company_id: companyId });
        }
      }
      onClose();
    } catch (err) {
      console.error('Erro ao criar parcelas:', err);
    } finally {
      setSaving(false);
    }
  };

  // ===== EDIT MODE =====
  if (isEdit) {
    return (
      <div className="parcela-dialog-overlay" onClick={onClose}>
        <div className="parcela-dialog" onClick={e => e.stopPropagation()}>
          <div className="parcela-dialog-header">
            <h3>Editar Parcela</h3>
            <button className="parcela-dialog-close" onClick={onClose}>&times;</button>
          </div>
          <form onSubmit={handleSubmitEdit} className="parcela-dialog-form">
            <div className="parcela-form-row">
              <div className="parcela-form-field">
                <label>Numero *</label>
                <input type="number" value={form.parcela_numero} disabled />
              </div>
              <div className="parcela-form-field">
                <label>Valor (R$)</label>
                <input type="number" step="0.01" min="0" value={form.valor} onChange={e => handleChange('valor', e.target.value)} placeholder="0.00" />
              </div>
            </div>

            <div className="parcela-form-field">
              <label>Descricao</label>
              <input type="text" value={form.descricao} onChange={e => handleChange('descricao', e.target.value)} placeholder="Ex: Parcela 1 - Fase 01" />
            </div>

            <div className="parcela-form-row">
              <div className="parcela-form-field">
                <label>Origem</label>
                <select value={form.origem} onChange={e => handleChange('origem', e.target.value)}>
                  {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="parcela-form-field">
                <label>Tipo de Servico</label>
                <select value={form.tipo_servico} onChange={e => handleChange('tipo_servico', e.target.value)}>
                  {TIPOS_SERVICO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ background: '#f6f6f6', border: '1px solid #e6e6e6', borderRadius: '8px', padding: '12px 14px' }}>
              <label className="parcela-form-checkbox">
                <input type="checkbox" checked={form.parcela_sem_cronograma} onChange={e => handleChange('parcela_sem_cronograma', e.target.checked)} />
                <span>Parcela sem vinculo ao cronograma</span>
              </label>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', marginLeft: '24px' }}>
                Para parcelas como entrada/sinal que nao dependem de entrega no cronograma
              </div>
            </div>

            <div className="parcela-dialog-actions">
              <button type="button" className="parcela-btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="parcela-btn-primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ===== BATCH CREATE MODE =====
  return (
    <div className="parcela-dialog-overlay" onClick={onClose}>
      <div className="parcela-dialog parcela-dialog--batch" onClick={e => e.stopPropagation()}>
        <div className="parcela-dialog-header">
          <h3>{isAditivo ? 'Parcelas de Aditivo SPOT' : 'Novas Parcelas'}</h3>
          <button className="parcela-dialog-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmitBatch} className="parcela-dialog-form">
          <div className="parcela-quantidade-field">
            <label>Quantidade de parcelas</label>
            <input type="number" min="1" max="20" value={quantidade} onChange={e => handleQuantidadeChange(e.target.value)} />
          </div>

          <div className="parcela-batch-header">
            <span>#</span>
            <span>Descricao</span>
            <span>Valor (R$)</span>
            <span>Origem</span>
            <span>Tipo Servico</span>
            <span>Sem Crono</span>
          </div>

          <div className="parcela-batch-rows">
            {batchRows.map((row, i) => (
              <div key={i} className="parcela-batch-row">
                <input type="number" value={row.parcela_numero} disabled className="parcela-batch-num" />
                <input type="text" value={row.descricao} onChange={e => handleBatchRowChange(i, 'descricao', e.target.value)} placeholder="Descricao..." />
                <input type="number" step="0.01" min="0" value={row.valor} onChange={e => handleBatchRowChange(i, 'valor', e.target.value)} placeholder="0.00" />
                <select value={row.origem} onChange={e => handleBatchRowChange(i, 'origem', e.target.value)}>
                  {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={row.tipo_servico} onChange={e => handleBatchRowChange(i, 'tipo_servico', e.target.value)}>
                  {TIPOS_SERVICO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label className="parcela-batch-checkbox">
                  <input type="checkbox" checked={row.parcela_sem_cronograma} onChange={e => handleBatchRowChange(i, 'parcela_sem_cronograma', e.target.checked)} />
                </label>
              </div>
            ))}
          </div>

          <div className="parcela-dialog-actions">
            <button type="button" className="parcela-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="parcela-btn-primary" disabled={saving}>
              {saving ? 'Criando...' : `Criar ${quantidade} Parcela${quantidade !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
