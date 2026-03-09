import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ParcelaStatusBadge from './ParcelaStatusBadge';
import './CalendarioPagamentosView.css';

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function CalendarioPagamentosView() {
  const [parcelas, setParcelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(3);
  const [leaderFilter, setLeaderFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ months: String(months) });
    if (leaderFilter) params.set('leader', leaderFilter);

    axios.get(`/api/pagamentos/upcoming?${params.toString()}`)
      .then(({ data }) => {
        if (data.success) setParcelas(data.data);
      })
      .catch(err => console.error('Erro ao buscar calendario:', err))
      .finally(() => setLoading(false));
  }, [months, leaderFilter]);

  const groupedByMonth = useMemo(() => {
    const groups = {};
    parcelas.forEach(p => {
      const date = p.data_pagamento_efetiva || p.data_pagamento_calculada || p.data_pagamento_manual;
      if (!date) return;
      const d = new Date(date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = { label: `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`, parcelas: [] };
      groups[key].parcelas.push(p);
    });
    // Sort by key
    const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([, v]) => v);
  }, [parcelas]);

  const formatCurrency = (v) => {
    if (v == null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  return (
    <div className="calendario-view">
      <div className="calendario-header">
        <h2>Calendario de Pagamentos</h2>
        <div className="calendario-filters">
          <select value={months} onChange={e => setMonths(Number(e.target.value))}>
            <option value={1}>Proximo mes</option>
            <option value={2}>Proximos 2 meses</option>
            <option value={3}>Proximos 3 meses</option>
            <option value={6}>Proximos 6 meses</option>
            <option value={12}>Proximo ano</option>
          </select>
          <input
            type="text"
            placeholder="Filtrar por lider..."
            value={leaderFilter}
            onChange={e => setLeaderFilter(e.target.value)}
            className="calendario-leader-filter"
          />
        </div>
      </div>

      {loading ? (
        <div className="parcelas-loading">Carregando calendario...</div>
      ) : groupedByMonth.length === 0 ? (
        <div className="parcelas-empty">Nenhum pagamento previsto no periodo</div>
      ) : (
        <div className="calendario-months">
          {groupedByMonth.map(group => {
            const totalMes = group.parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
            return (
              <div key={group.label} className="calendario-month-card">
                <div className="calendario-month-header">
                  <h3>{group.label}</h3>
                  <span className="calendario-month-total">
                    {group.parcelas.length} parcela{group.parcelas.length !== 1 ? 's' : ''} - {formatCurrency(totalMes)}
                  </span>
                </div>
                <div className="calendario-month-items">
                  {group.parcelas.map(p => (
                    <div key={p.id} className="calendario-item">
                      <div className="calendario-item-main">
                        <span className="calendario-item-project">{p.project_code}</span>
                        <span className="calendario-item-desc">Parcela {p.parcela_numero}{p.descricao ? ` - ${p.descricao}` : ''}</span>
                      </div>
                      <div className="calendario-item-meta">
                        <span>{formatDate(p.data_pagamento_efetiva || p.data_pagamento_calculada)}</span>
                        <span>{formatCurrency(p.valor)}</span>
                        <ParcelaStatusBadge status={p.status_financeiro} type="financeiro" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
