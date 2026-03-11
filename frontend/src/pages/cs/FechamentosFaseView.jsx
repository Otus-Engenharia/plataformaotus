/**
 * Calendário de Fechamentos de Fase — Área CS
 * Timeline dos próximos fechamentos de fase por projeto.
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import './FechamentosFaseView.css';

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateShort(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getStatusClass(status) {
  if (!status) return 'status-pendente';
  const s = status.toLowerCase();
  if (s.includes('conclu') || s.includes('complet') || s === 'complete') return 'status-concluido';
  if (s.includes('andamento') || s.includes('in progress') || s.includes('started')) return 'status-andamento';
  return 'status-pendente';
}

function getStatusLabel(status) {
  if (!status) return 'Pendente';
  const s = status.toLowerCase();
  if (s.includes('conclu') || s.includes('complet') || s === 'complete') return 'Concluído';
  if (s.includes('andamento') || s.includes('in progress') || s.includes('started')) return 'Em andamento';
  return 'Pendente';
}

function FechamentosFaseView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonths, setFilterMonths] = useState(6);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/cs/fechamentos-fase`, { withCredentials: true });
        setData(res.data.data || []);
      } catch (err) {
        console.error('Erro ao buscar fechamentos:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Generate month columns for the timeline
  const months = useMemo(() => {
    const result = [];
    const now = new Date();
    // Start from 1 month ago
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    for (let i = 0; i < filterMonths + 1; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      result.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return result;
  }, [filterMonths]);

  // Filter projects by date range and status
  const filteredData = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + filterMonths, 0);

    return data
      .map(project => {
        const fechamentos = project.fechamentos.filter(f => {
          const d = parseDate(f.end_date);
          if (!d) return false;
          if (d < startDate || d > endDate) return false;
          if (filterStatus) {
            const statusClass = getStatusClass(f.status);
            if (statusClass !== filterStatus) return false;
          }
          return true;
        });
        if (fechamentos.length === 0) return null;
        return { ...project, fechamentos };
      })
      .filter(Boolean);
  }, [data, filterMonths, filterStatus]);

  // Map fechamentos to month columns
  function getFechamentosForMonth(project, monthKey) {
    return project.fechamentos.filter(f => {
      const d = parseDate(f.end_date);
      if (!d) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === monthKey;
    });
  }

  // Count totals
  const totalFechamentos = filteredData.reduce((s, p) => s + p.fechamentos.length, 0);
  const totalConcluidos = filteredData.reduce((s, p) =>
    s + p.fechamentos.filter(f => getStatusClass(f.status) === 'status-concluido').length, 0);
  const totalPendentes = totalFechamentos - totalConcluidos;

  return (
    <div className="fechamentos-view">
      <h1>Calendário de Fechamentos de Fase</h1>
      <p className="fechamentos-subtitle">
        Próximos fechamentos de fase dos projetos, baseado no cronograma Smartsheet.
      </p>

      {/* Filters */}
      <div className="fechamentos-filters">
        <div className="fechamentos-filter-group">
          <label>Período</label>
          <select value={filterMonths} onChange={e => setFilterMonths(Number(e.target.value))}>
            <option value={3}>Próximos 3 meses</option>
            <option value={6}>Próximos 6 meses</option>
            <option value={12}>Próximos 12 meses</option>
          </select>
        </div>
        <div className="fechamentos-filter-group">
          <label>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="status-pendente">Pendente</option>
            <option value="status-andamento">Em andamento</option>
            <option value="status-concluido">Concluído</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="fechamentos-summary">
        <span>{filteredData.length} projetos</span>
        <span>{totalFechamentos} fechamentos</span>
        <span className="fechamentos-summary-green">{totalConcluidos} concluídos</span>
        <span className="fechamentos-summary-yellow">{totalPendentes} pendentes</span>
      </div>

      {loading ? (
        <p className="fechamentos-loading">Carregando...</p>
      ) : filteredData.length === 0 ? (
        <p className="fechamentos-empty">Nenhum fechamento de fase encontrado no período.</p>
      ) : (
        <div className="fechamentos-timeline-container">
          <table className="fechamentos-timeline">
            <thead>
              <tr>
                <th className="fechamentos-project-col">Projeto</th>
                {months.map(m => (
                  <th key={m.key} className="fechamentos-month-col">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((project, i) => (
                <tr key={i}>
                  <td className="fechamentos-project-cell">
                    <span className="fechamentos-project-name">
                      {project.project_name}
                    </span>
                    {project.project_code && (
                      <span className="fechamentos-project-code">{project.project_code}</span>
                    )}
                  </td>
                  {months.map(m => {
                    const items = getFechamentosForMonth(project, m.key);
                    return (
                      <td key={m.key} className="fechamentos-month-cell">
                        {items.map((f, j) => (
                          <div key={j} className={`fechamentos-card ${getStatusClass(f.status)}`} title={f.task_name}>
                            <span className="fechamentos-card-name">{f.task_name.replace(/fechamento\s*de?\s*fase\s*/i, 'Fase ')}</span>
                            <span className="fechamentos-card-date">{formatDateShort(f.end_date)}</span>
                            <span className="fechamentos-card-status">{getStatusLabel(f.status)}</span>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default FechamentosFaseView;
