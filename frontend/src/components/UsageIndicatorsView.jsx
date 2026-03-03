/**
 * Componente: Indicadores de Uso da Plataforma
 *
 * Duas seções:
 * 1. Taxa de Uso Mensal — % de cada setor que acessou a plataforma no mês
 * 2. Tempo de Tela — horas de uso por pessoa (baseado em heartbeats)
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/UsageIndicatorsView.css';

const MESES_LABEL = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

function formatMes(ym) {
  if (!ym) return ym;
  const [year, month] = ym.split('-');
  return `${MESES_LABEL[month] || month}/${year}`;
}

function formatHoras(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${m}min`;
}

// ── Seção: Taxa de Uso ───────────────────────────────────────────
function TaxaUsoSection() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState(6);
  const [setorFiltro, setSetorFiltro] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ months });
      const { data: resp } = await axios.get(
        `${API_URL}/api/admin/usage-indicators/taxa-uso?${params}`,
        { withCredentials: true }
      );
      if (resp.success) setData(resp.data || []);
      else setError(resp.error || 'Erro ao carregar taxa de uso');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [months]);

  const setores = [...new Set(data.map(d => d.setor))].sort();
  const filtered = setorFiltro ? data.filter(d => d.setor === setorFiltro) : data;

  // Agrupa por mês para renderização
  const byMes = {};
  for (const row of filtered) {
    if (!byMes[row.mes]) byMes[row.mes] = [];
    byMes[row.mes].push(row);
  }
  const mesesOrdenados = Object.keys(byMes).sort().reverse();

  return (
    <section className="usage-section">
      <div className="usage-section-header">
        <h3>Taxa de Acesso Mensal</h3>
        <p className="usage-section-desc">
          % de colaboradores de cada setor que acessaram a plataforma pelo menos uma vez no mês.
        </p>
      </div>

      <div className="usage-filters">
        <div className="filter-group-inline">
          <label>Período</label>
          <select value={months} onChange={e => setMonths(Number(e.target.value))}>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>
        <div className="filter-group-inline">
          <label>Setor</label>
          <select value={setorFiltro} onChange={e => setSetorFiltro(e.target.value)}>
            <option value="">Todos</option>
            {setores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="usage-loading">Carregando...</div>}
      {error && <div className="usage-error">{error}</div>}

      {!loading && !error && mesesOrdenados.length === 0 && (
        <div className="usage-empty">Nenhum dado encontrado para o período.</div>
      )}

      {!loading && !error && mesesOrdenados.length > 0 && (
        <div className="taxa-table-wrapper">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Setor</th>
                <th>Acessaram</th>
                <th>Total</th>
                <th>Taxa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mesesOrdenados.map(mes => {
                const rows = byMes[mes];
                return rows.map((row, idx) => (
                  <tr key={`${mes}-${row.setor}`}>
                    {idx === 0 && (
                      <td rowSpan={rows.length} className="mes-cell">
                        {formatMes(mes)}
                      </td>
                    )}
                    <td>{row.setor}</td>
                    <td className="num-cell">{row.acessaram}</td>
                    <td className="num-cell">{row.total}</td>
                    <td className="num-cell">
                      <span className={`taxa-badge ${row.taxa >= 80 ? 'alta' : row.taxa >= 50 ? 'media' : 'baixa'}`}>
                        {row.taxa}%
                      </span>
                    </td>
                    <td>
                      <div className="taxa-bar">
                        <div
                          className={`taxa-bar-fill ${row.taxa >= 80 ? 'alta' : row.taxa >= 50 ? 'media' : 'baixa'}`}
                          style={{ width: `${row.taxa}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Seção: Tempo de Tela ─────────────────────────────────────────
function TempoTelaSection() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [setorFiltro, setSetorFiltro] = useState('Operação');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (setorFiltro) params.append('setor', setorFiltro);
      const { data: resp } = await axios.get(
        `${API_URL}/api/admin/usage-indicators/screen-time?${params}`,
        { withCredentials: true }
      );
      if (resp.success) setData(resp.data || []);
      else setError(resp.error || 'Erro ao carregar tempo de tela');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const setores = [...new Set(data.map(d => d.setor_name))].sort();

  return (
    <section className="usage-section">
      <div className="usage-section-header">
        <h3>Tempo de Tela por Pessoa</h3>
        <p className="usage-section-desc">
          Tempo estimado de uso ativo da plataforma (heartbeat a cada 5 minutos quando a aba está em foco).
        </p>
      </div>

      <div className="usage-filters">
        <div className="filter-group-inline">
          <label>Data Inicial</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="filter-group-inline">
          <label>Data Final</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="filter-group-inline">
          <label>Setor</label>
          <select value={setorFiltro} onChange={e => setSetorFiltro(e.target.value)}>
            <option value="">Todos</option>
            {setores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={fetchData} className="btn-apply-small">Aplicar</button>
      </div>

      {loading && <div className="usage-loading">Carregando...</div>}
      {error && <div className="usage-error">{error}</div>}

      {!loading && !error && data.length === 0 && (
        <div className="usage-empty">
          Nenhum dado de heartbeat para o período. O rastreamento começa a partir de agora.
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <table className="usage-table">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Setor</th>
              <th>Dias Ativos</th>
              <th>Total no Período</th>
              <th>Média por Dia Ativo</th>
            </tr>
          </thead>
          <tbody>
            {data.map(u => (
              <tr key={u.user_email}>
                <td>
                  <div className="user-info">
                    <div className="user-name">{u.user_name || u.user_email}</div>
                    <div className="user-email">{u.user_email}</div>
                  </div>
                </td>
                <td>{u.setor_name}</td>
                <td className="num-cell">{u.days_active}d</td>
                <td className="num-cell">{formatHoras(u.total_minutos)}</td>
                <td className="num-cell">{formatHoras(u.avg_minutos_por_dia)}/dia</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ── Componente raiz ──────────────────────────────────────────────
function UsageIndicatorsView() {
  return (
    <div className="usage-container">
      <div className="usage-page-header">
        <h2>Indicadores de Uso</h2>
        <p>Métricas de engajamento da equipe com a Plataforma Otus.</p>
      </div>
      <TaxaUsoSection />
      <TempoTelaSection />
    </div>
  );
}

export default UsageIndicatorsView;
