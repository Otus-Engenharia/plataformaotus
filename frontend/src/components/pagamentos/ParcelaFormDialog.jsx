import React, { useState, useEffect } from 'react';
import './ParcelaFormDialog.css';

const ORIGENS = ['Contrato', 'Aditivo', 'Reajuste', 'Outro'];

export default function ParcelaFormDialog({ open, onClose, onSave, parcela, projectCode, companyId, isAditivo = false }) {
  const isEdit = !!parcela;

  const [form, setForm] = useState({
    parcela_numero: '',
    descricao: '',
    valor: '',
    origem: 'Contrato',
    fase: '',
    comentario_financeiro: '',
    data_pagamento_manual: '',
    parcela_sem_cronograma: false,
    gerente_email: '',
    tipo_servico: 'coordenacao',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (parcela) {
      setForm({
        parcela_numero: parcela.parcela_numero || '',
        descricao: parcela.descricao || '',
        valor: parcela.valor || '',
        origem: parcela.origem || 'Contrato',
        fase: parcela.fase || '',
        comentario_financeiro: parcela.comentario_financeiro || '',
        data_pagamento_manual: parcela.data_pagamento_manual || '',
        parcela_sem_cronograma: parcela.parcela_sem_cronograma || false,
        gerente_email: parcela.gerente_email || '',
        tipo_servico: parcela.tipo_servico || 'coordenacao',
      });
    } else {
      setForm({
        parcela_numero: '',
        descricao: '',
        valor: '',
        origem: isAditivo ? 'Aditivo' : 'Contrato',
        fase: '',
        comentario_financeiro: '',
        data_pagamento_manual: '',
        parcela_sem_cronograma: false,
        gerente_email: '',
        tipo_servico: 'coordenacao',
      });
    }
  }, [parcela, open, isAditivo]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.parcela_numero) return;
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

  return (
    <div className="parcela-dialog-overlay" onClick={onClose}>
      <div className="parcela-dialog" onClick={e => e.stopPropagation()}>
        <div className="parcela-dialog-header">
          <h3>{isEdit ? 'Editar Parcela' : isAditivo ? 'Parcela de Aditivo SPOT' : 'Nova Parcela'}</h3>
          <button className="parcela-dialog-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="parcela-dialog-form">
          <div className="parcela-form-row">
            <div className="parcela-form-field">
              <label>Numero da Parcela *</label>
              <input
                type="number"
                min="1"
                value={form.parcela_numero}
                onChange={e => handleChange('parcela_numero', e.target.value)}
                required
                disabled={isEdit}
              />
            </div>
            <div className="parcela-form-field">
              <label>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={e => handleChange('valor', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="parcela-form-field">
            <label>Descricao</label>
            <input
              type="text"
              value={form.descricao}
              onChange={e => handleChange('descricao', e.target.value)}
              placeholder="Ex: Parcela 1 - Fase 01"
            />
          </div>

          <div className="parcela-form-row">
            <div className="parcela-form-field">
              <label>Origem</label>
              <select value={form.origem} onChange={e => handleChange('origem', e.target.value)}>
                {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="parcela-form-field">
              <label>Fase</label>
              <input
                type="text"
                value={form.fase}
                onChange={e => handleChange('fase', e.target.value)}
                placeholder="Ex: Fase 01"
              />
            </div>
          </div>

          <div className="parcela-form-field">
            <label>Tipo de Servico</label>
            <select value={form.tipo_servico} onChange={e => handleChange('tipo_servico', e.target.value)}>
              <option value="coordenacao">Coordenacao</option>
              <option value="modelagem">Modelagem</option>
            </select>
          </div>

          <div className="parcela-form-field">
            <label>Email do Gerente (Lider)</label>
            <input
              type="email"
              value={form.gerente_email}
              onChange={e => handleChange('gerente_email', e.target.value)}
              placeholder="lider@otusengenharia.com"
            />
          </div>

          <div className="parcela-form-field">
            <label>Comentario Financeiro</label>
            <textarea
              value={form.comentario_financeiro}
              onChange={e => handleChange('comentario_financeiro', e.target.value)}
              rows={2}
              placeholder="Observacoes do financeiro..."
            />
          </div>

          <div className="parcela-form-field">
            <label>Data de Pagamento Manual</label>
            <input
              type="date"
              value={form.data_pagamento_manual}
              onChange={e => handleChange('data_pagamento_manual', e.target.value)}
            />
          </div>

          <div style={{ background: '#f6f6f6', border: '1px solid #e6e6e6', borderRadius: '8px', padding: '12px 14px' }}>
            <label className="parcela-form-checkbox">
              <input
                type="checkbox"
                checked={form.parcela_sem_cronograma}
                onChange={e => handleChange('parcela_sem_cronograma', e.target.checked)}
              />
              <span>Parcela sem vinculo ao cronograma</span>
            </label>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', marginLeft: '24px' }}>
              Para parcelas como entrada/sinal que nao dependem de entrega no cronograma
            </div>
          </div>

          <div className="parcela-dialog-actions">
            <button type="button" className="parcela-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="parcela-btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : (isEdit ? 'Salvar' : 'Criar Parcela')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
