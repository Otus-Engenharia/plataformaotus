/**
 * Componente: Compliance de Horas — Setor Operação
 *
 * Mostra uma matriz de compliance semanal de horas lançadas:
 * - Analistas: ≥ 36h/semana
 * - Estagiários: ≥ 27h/semana
 * Apenas para usuários do setor Operação com cargos rastreados.
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/ComplianceHorasView.css';

function formatSemana(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
}

function StatusCell({ s }) {
  if (!s) return <td className="cell-sem-dados" title="Sem dados">—</td>;
  if (s.status === 'sem_dados') return <td className="cell-sem-dados" title="Sem lançamento">—</td>;
  if (s.status === 'ok') {
    return (
      <td className="cell-ok" title={`${s.horas}h lançadas (≥ threshold)`}>
        {s.horas}h
      </td>
    );
  }
  return (
    <td className="cell-abaixo" title={`${s.horas}h lançadas (abaixo do mínimo)`}>
      {s.horas}h
    </td>
  );
}

function ComplianceHorasView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [semanas, setSemanas] = useState(8);
  const [teamFiltro, setTeamFiltro] = useState('');
  const [cargoFiltro, setCargoFiltro] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: resp } = await axios.get(
        `${API_URL}/api/admin/hours-compliance?semanas=${semanas}`,
        { withCredentials: true }
      );
      if (resp.success) setData(resp);
      else setError(resp.error || 'Erro ao carregar compliance');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [semanas]);

  const teams = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.pessoas.map(p => p.team_name).filter(Boolean))].sort();
  }, [data]);

  const cargos = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.pessoas.map(p => p.cargo_name).filter(Boolean))].sort();
  }, [data]);

  const pessoasFiltradas = useMemo(() => {
    if (!data) return [];
    return data.pessoas
      .filter(p => !teamFiltro || p.team_name === teamFiltro)
      .filter(p => !cargoFiltro || p.cargo_name === cargoFiltro);
  }, [data, teamFiltro, cargoFiltro]);

  // Identifica quem falhou em >50% das semanas com dados
  const alertas = useMemo(() => {
    if (!pessoasFiltradas.length) return [];
    return pessoasFiltradas
      .filter(p => p.taxa_compliance !== null && p.taxa_compliance < 50)
      .sort((a, b) => (a.taxa_compliance ?? 100) - (b.taxa_compliance ?? 100));
  }, [pessoasFiltradas]);

  if (loading) return <div className="compliance-container"><div className="compliance-loading">Carregando dados de compliance...</div></div>;
  if (error) return (
    <div className="compliance-container">
      <div className="compliance-error">
        <p>{error}</p>
        <button onClick={fetchData} className="btn-retry">Tentar novamente</button>
      </div>
    </div>
  );

  const semanasLista = data?.semanas || [];

  return (
    <div className="compliance-container">
      <div className="compliance-header">
        <div>
          <h2>Compliance de Horas</h2>
          <p className="compliance-desc">
            Setor Operação — Analistas ≥ 36h/semana · Estagiários ≥ 27h/semana
          </p>
        </div>
        <button onClick={fetchData} className="btn-refresh">Atualizar</button>
      </div>

      {alertas.length > 0 && (
        <div className="compliance-alertas">
          <div className="alerta-title">Atenção: Baixo compliance</div>
          <div className="alerta-list">
            {alertas.map(p => (
              <div key={p.email} className="alerta-item">
                <span className="alerta-nome">{p.name}</span>
                <span className="alerta-cargo">{p.cargo_name}</span>
                <span className="alerta-taxa">{p.taxa_compliance}% de semanas ok</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="compliance-filters">
        <div className="filter-group-inline">
          <label>Semanas</label>
          <select value={semanas} onChange={e => setSemanas(Number(e.target.value))}>
            <option value={4}>4 semanas</option>
            <option value={8}>8 semanas</option>
            <option value={12}>12 semanas</option>
            <option value={26}>26 semanas</option>
          </select>
        </div>
        <div className="filter-group-inline">
          <label>Equipe</label>
          <select value={teamFiltro} onChange={e => setTeamFiltro(e.target.value)}>
            <option value="">Todas</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="filter-group-inline">
          <label>Cargo</label>
          <select value={cargoFiltro} onChange={e => setCargoFiltro(e.target.value)}>
            <option value="">Todos</option>
            {cargos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="compliance-legend">
        <span className="legend-ok">✓ Atingiu</span>
        <span className="legend-abaixo">✗ Abaixo</span>
        <span className="legend-sem-dados">— Sem lançamento</span>
      </div>

      <div className="compliance-table-wrapper">
        <table className="compliance-table">
          <thead>
            <tr>
              <th className="col-nome">Pessoa</th>
              <th className="col-cargo">Cargo</th>
              <th className="col-threshold">Mínimo</th>
              <th className="col-taxa">% Ok</th>
              {semanasLista.map(s => (
                <th key={s} className="col-semana">{formatSemana(s)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pessoasFiltradas.length === 0 ? (
              <tr><td colSpan={4 + semanasLista.length} className="empty-state">Nenhuma pessoa encontrada</td></tr>
            ) : (
              pessoasFiltradas.map(p => (
                <tr key={p.email}>
                  <td className="col-nome-cell">
                    <div className="person-name">{p.name}</div>
                    <div className="person-team">{p.team_name || '—'}</div>
                  </td>
                  <td className="col-cargo-cell">{p.cargo_name || '—'}</td>
                  <td className="col-threshold-cell">{p.threshold}h</td>
                  <td className="col-taxa-cell">
                    {p.taxa_compliance !== null ? (
                      <span className={`taxa-pill ${p.taxa_compliance >= 80 ? 'alta' : p.taxa_compliance >= 50 ? 'media' : 'baixa'}`}>
                        {p.taxa_compliance}%
                      </span>
                    ) : '—'}
                  </td>
                  {p.semanas.map(s => <StatusCell key={s.semana} s={s} />)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ComplianceHorasView;
