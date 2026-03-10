import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import InlineDilatacaoInput from './InlineDilatacaoInput';
import InlineStatusDropdown from './InlineStatusDropdown';
import { STATUS_FINANCEIRO_CONFIG } from './ParcelaStatusBadge';
import './CronogramaFisicoFinanceiroPanel.css';

const STATUS_FINANCEIRO_OPTIONS = Object.entries(STATUS_FINANCEIRO_CONFIG).map(([value, cfg]) => ({
  value, label: cfg.label, color: cfg.color,
}));

const formatCurrency = (v) => {
  if (v == null) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

function getMonthColumns(numMonths) {
  const now = new Date();
  const months = [];
  for (let i = 0; i < numMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    months.push({ key, label });
  }
  return months;
}

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CronogramaFisicoFinanceiroPanel({ leaders, showLiderFilter, showStatusColumn = false }) {
  const [parcelas, setParcelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [numMonths, setNumMonths] = useState(12);
  const [filterLider, setFilterLider] = useState('');
  const [ocultarFaturados, setOcultarFaturados] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ months: numMonths });
      if (filterLider) params.set('leader', filterLider);
      const { data } = await axios.get(`/api/pagamentos/cronograma-financeiro?${params}`);
      if (data.success) setParcelas(data.data);
    } catch (err) {
      console.error('Erro ao carregar cronograma financeiro:', err);
    } finally {
      setLoading(false);
    }
  }, [numMonths, filterLider]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthColumns = useMemo(() => getMonthColumns(numMonths), [numMonths]);

  // Client-side filter + sort as safety net (backend already filters)
  const filteredParcelas = useMemo(() => {
    const monthKeys = new Set(monthColumns.map(m => m.key));
    const today = new Date();
    return parcelas
      .filter(p => {
        if (ocultarFaturados && p.status_financeiro === 'faturado') return false;
        const dateStr = p.data_pagamento_efetiva || p.data_pagamento_calculada || p.data_pagamento_manual;
        if (!dateStr) return false;
        const mk = getMonthKey(dateStr);
        // Include if in visible month columns OR already overdue
        return (mk && monthKeys.has(mk)) || new Date(dateStr) < today;
      })
      .sort((a, b) => {
        const da = new Date(a.data_pagamento_efetiva || a.data_pagamento_calculada || a.data_pagamento_manual);
        const db = new Date(b.data_pagamento_efetiva || b.data_pagamento_calculada || b.data_pagamento_manual);
        return da - db;
      });
  }, [parcelas, monthColumns, ocultarFaturados]);

  // Totals per month
  const monthTotals = useMemo(() => {
    const totals = {};
    monthColumns.forEach(m => { totals[m.key] = 0; });
    filteredParcelas.forEach(p => {
      const dateStr = p.data_pagamento_efetiva || p.data_pagamento_calculada || p.data_pagamento_manual;
      const mk = getMonthKey(dateStr);
      if (mk && totals[mk] !== undefined) {
        totals[mk] += Number(p.valor) || 0;
      }
    });
    return totals;
  }, [filteredParcelas, monthColumns]);

  const handleDilatacaoChanged = (updatedParcela) => {
    setParcelas(prev => prev.map(p => p.id === updatedParcela.id ? { ...updatedParcela, project_name: p.project_name, project_status: p.project_status } : p));
  };

  const handleStatusChanged = (updatedParcela) => {
    setParcelas(prev => prev.map(p => p.id === updatedParcela.id
      ? { ...updatedParcela, project_name: p.project_name, project_status: p.project_status }
      : p));
  };

  if (loading) {
    return <div className="crono-fin-loading">Carregando cronograma financeiro...</div>;
  }

  return (
    <div className="crono-fin-container">
      {/* Controls */}
      <div className="crono-fin-controls">
        <div className="crono-fin-controls-left">
          <span className="crono-fin-controls-label">Periodo</span>
          <div className="crono-fin-period-btns">
            {[6, 12, 18, 24].map(n => (
              <button
                key={n}
                className={`crono-fin-period-btn ${numMonths === n ? 'active' : ''}`}
                onClick={() => setNumMonths(n)}
              >
                {n}m
              </button>
            ))}
          </div>
          <label className="pagamentos-lider-toggle" style={{ marginLeft: '1.5rem' }}>
            <input type="checkbox" checked={ocultarFaturados}
              onChange={e => setOcultarFaturados(e.target.checked)} />
            <span className="pagamentos-lider-toggle-slider"></span>
            <span className="pagamentos-lider-toggle-label">Ocultar Faturados</span>
          </label>
        </div>
        {showLiderFilter && (
          <select
            className="pagamentos-fin-filter-select"
            value={filterLider}
            onChange={e => setFilterLider(e.target.value)}
          >
            <option value="">Todos os lideres</option>
            {(leaders || []).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </div>

      {filteredParcelas.length === 0 ? (
        <div className="crono-fin-empty">Nenhuma parcela encontrada</div>
      ) : (
        <div className="crono-fin-table-wrapper">
          <table className="crono-fin-table">
            <thead>
              <tr>
                <th className="crono-fin-sticky-col crono-fin-col-projeto">Projeto</th>
                <th className="crono-fin-sticky-col crono-fin-col-parcela">Parcela</th>
                <th className="crono-fin-sticky-col crono-fin-col-valor">Valor</th>
                <th className="crono-fin-sticky-col crono-fin-col-dilatacao">Dilat.</th>
                {showStatusColumn && <th className="crono-fin-sticky-col crono-fin-col-status">Status</th>}
                {monthColumns.map(m => (
                  <th key={m.key} className="crono-fin-month-col">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredParcelas.map(p => {
                const dateStr = p.data_pagamento_efetiva || p.data_pagamento_calculada || p.data_pagamento_manual;
                const parcelaMonthKey = getMonthKey(dateStr);
                const isFaturado = p.status_financeiro === 'faturado';
                const isAtrasado = !isFaturado && dateStr && new Date(dateStr) < new Date();

                return (
                  <tr key={p.id} className={isFaturado ? 'crono-fin-row-faturado' : ''}>
                    <td className="crono-fin-sticky-col crono-fin-col-projeto">
                      <strong>{p.project_code}</strong>
                      {p.project_name && <span className="crono-fin-project-name">{p.project_name}</span>}
                    </td>
                    <td className="crono-fin-sticky-col crono-fin-col-parcela">
                      {p.descricao || `#${p.parcela_numero}`}
                    </td>
                    <td className="crono-fin-sticky-col crono-fin-col-valor">
                      {formatCurrency(p.valor)}
                    </td>
                    <td className="crono-fin-sticky-col crono-fin-col-dilatacao">
                      <InlineDilatacaoInput
                        parcelaId={p.id}
                        currentValue={p.dilatacao_dias || 0}
                        onChanged={handleDilatacaoChanged}
                      />
                    </td>
                    {showStatusColumn && (
                      <td className="crono-fin-sticky-col crono-fin-col-status">
                        <InlineStatusDropdown
                          parcelaId={p.id}
                          field="financeiro"
                          currentStatus={p.status_financeiro}
                          statusOptions={STATUS_FINANCEIRO_OPTIONS}
                          onStatusChanged={handleStatusChanged}
                        />
                      </td>
                    )}
                    {monthColumns.map(m => (
                      <td key={m.key} className={`crono-fin-month-cell ${parcelaMonthKey === m.key ? (isFaturado ? 'crono-fin-cell-faturado' : isAtrasado ? 'crono-fin-cell-atrasado' : 'crono-fin-cell-pendente') : ''}`}>
                        {parcelaMonthKey === m.key ? formatCurrency(p.valor) : ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="crono-fin-totals-row">
                <td className="crono-fin-sticky-col crono-fin-col-projeto" colSpan={showStatusColumn ? 5 : 4}><strong>Total</strong></td>
                {monthColumns.map(m => (
                  <td key={m.key} className="crono-fin-month-cell crono-fin-total-cell">
                    {monthTotals[m.key] > 0 ? formatCurrency(monthTotals[m.key]) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
