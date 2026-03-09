import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './RegrasClientePanel.css';

export default function RegrasClientePanel() {
  const [regras, setRegras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    company_id: '', company_name: '', precisa_medicao: false,
    dias_solicitar_medicao: 0, dias_aprovacao_medicao: 0,
    dias_antecedencia_faturamento: 0, observacao_financeiro: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchRegras = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/pagamentos/regras-cliente');
      if (data.success) setRegras(data.data);
    } catch (err) {
      console.error('Erro ao buscar regras:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRegras(); }, [fetchRegras]);

  const handleEdit = (regra) => {
    setEditingId(regra.company_id);
    setEditForm({
      precisa_medicao: regra.precisa_medicao,
      dias_solicitar_medicao: regra.dias_solicitar_medicao,
      dias_aprovacao_medicao: regra.dias_aprovacao_medicao,
      dias_antecedencia_faturamento: regra.dias_antecedencia_faturamento,
      observacao_financeiro: regra.observacao_financeiro || '',
    });
  };

  const handleSaveEdit = async (companyId) => {
    setSaving(true);
    try {
      await axios.put(`/api/pagamentos/regras-cliente/${companyId}`, editForm);
      setEditingId(null);
      fetchRegras();
    } catch (err) {
      console.error('Erro ao salvar regra:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newForm.company_id || !newForm.company_name) return;
    setSaving(true);
    try {
      await axios.post('/api/pagamentos/regras-cliente', newForm);
      setShowNewForm(false);
      setNewForm({ company_id: '', company_name: '', precisa_medicao: false, dias_solicitar_medicao: 0, dias_aprovacao_medicao: 0, dias_antecedencia_faturamento: 0, observacao_financeiro: '' });
      fetchRegras();
    } catch (err) {
      console.error('Erro ao criar regra:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="regras-panel">
      <div className="regras-panel-header">
        <h3>Regras de Pagamento por Cliente</h3>
        <button className="parcela-btn-primary" onClick={() => setShowNewForm(!showNewForm)}>
          {showNewForm ? 'Cancelar' : '+ Nova Regra'}
        </button>
      </div>

      {showNewForm && (
        <div className="regras-new-form">
          <div className="regras-form-row">
            <div className="parcela-form-field">
              <label>ID do Cliente *</label>
              <input type="text" value={newForm.company_id} onChange={e => setNewForm(p => ({ ...p, company_id: e.target.value }))} placeholder="Ex: COMP-001" />
            </div>
            <div className="parcela-form-field">
              <label>Nome do Cliente *</label>
              <input type="text" value={newForm.company_name} onChange={e => setNewForm(p => ({ ...p, company_name: e.target.value }))} placeholder="Nome da empresa" />
            </div>
          </div>
          <div className="regras-form-row">
            <label className="parcela-form-checkbox">
              <input type="checkbox" checked={newForm.precisa_medicao} onChange={e => setNewForm(p => ({ ...p, precisa_medicao: e.target.checked }))} />
              <span>Precisa medicao</span>
            </label>
            <div className="parcela-form-field">
              <label>Dias p/ solicitar medicao</label>
              <input type="number" min="0" value={newForm.dias_solicitar_medicao} onChange={e => setNewForm(p => ({ ...p, dias_solicitar_medicao: Number(e.target.value) }))} />
            </div>
            <div className="parcela-form-field">
              <label>Dias aprovacao medicao</label>
              <input type="number" min="0" value={newForm.dias_aprovacao_medicao} onChange={e => setNewForm(p => ({ ...p, dias_aprovacao_medicao: Number(e.target.value) }))} />
            </div>
            <div className="parcela-form-field">
              <label>Dias antecedencia faturamento</label>
              <input type="number" min="0" value={newForm.dias_antecedencia_faturamento} onChange={e => setNewForm(p => ({ ...p, dias_antecedencia_faturamento: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="parcela-form-field">
            <label>Observacao</label>
            <textarea value={newForm.observacao_financeiro} onChange={e => setNewForm(p => ({ ...p, observacao_financeiro: e.target.value }))} rows={2} />
          </div>
          <button className="parcela-btn-primary" onClick={handleCreateNew} disabled={saving}>{saving ? 'Salvando...' : 'Criar Regra'}</button>
        </div>
      )}

      {loading ? (
        <div className="parcelas-loading">Carregando regras...</div>
      ) : regras.length === 0 ? (
        <div className="parcelas-empty">Nenhuma regra cadastrada</div>
      ) : (
        <div className="parcelas-table-container">
          <table className="parcelas-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Medicao</th>
                <th>Dias Solicitar</th>
                <th>Dias Aprovacao</th>
                <th>Dias Faturamento</th>
                <th>Total Dias</th>
                <th>Observacao</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {regras.map(r => (
                <tr key={r.company_id}>
                  <td><strong>{r.company_name}</strong></td>
                  {editingId === r.company_id ? (
                    <>
                      <td>
                        <input type="checkbox" checked={editForm.precisa_medicao} onChange={e => setEditForm(p => ({ ...p, precisa_medicao: e.target.checked }))} />
                      </td>
                      <td><input type="number" min="0" className="regras-inline-input" value={editForm.dias_solicitar_medicao} onChange={e => setEditForm(p => ({ ...p, dias_solicitar_medicao: Number(e.target.value) }))} /></td>
                      <td><input type="number" min="0" className="regras-inline-input" value={editForm.dias_aprovacao_medicao} onChange={e => setEditForm(p => ({ ...p, dias_aprovacao_medicao: Number(e.target.value) }))} /></td>
                      <td><input type="number" min="0" className="regras-inline-input" value={editForm.dias_antecedencia_faturamento} onChange={e => setEditForm(p => ({ ...p, dias_antecedencia_faturamento: Number(e.target.value) }))} /></td>
                      <td>{(editForm.dias_solicitar_medicao || 0) + (editForm.dias_aprovacao_medicao || 0) + (editForm.dias_antecedencia_faturamento || 0)}</td>
                      <td><input type="text" className="regras-inline-input regras-obs-input" value={editForm.observacao_financeiro} onChange={e => setEditForm(p => ({ ...p, observacao_financeiro: e.target.value }))} /></td>
                      <td>
                        <div className="parcelas-actions-cell">
                          <button className="parcela-btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => handleSaveEdit(r.company_id)} disabled={saving}>Salvar</button>
                          <button className="parcela-btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{r.precisa_medicao ? 'Sim' : 'Nao'}</td>
                      <td>{r.dias_solicitar_medicao}</td>
                      <td>{r.dias_aprovacao_medicao}</td>
                      <td>{r.dias_antecedencia_faturamento}</td>
                      <td><strong>{r.total_dias}</strong></td>
                      <td>{r.observacao_financeiro || '-'}</td>
                      <td>
                        <button className="parcelas-action-btn" title="Editar" onClick={() => handleEdit(r)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
