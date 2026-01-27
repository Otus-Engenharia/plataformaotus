/**
 * Vista CS – NPS do setor de sucesso do cliente
 *
 * Dados: dadosindicadores.CS.CS_NPS_pbi
 * Vínculo: dadosindicadores.portifolio.port_clientes (Prt___Cliente = Cliente)
 * Líderes veem apenas o time (Ultimo_Time); privilegiados veem todos.
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { API_URL } from '../api';
import '../styles/CSView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

function formatLastUpdate(date) {
  if (!date) return null;
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CSView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFilters] = useState({ campanhas: [], organizacoes: [], cargos: [] });
  const [applied, setApplied] = useState({ campanha: '', organizacao: '', cargo: '' });

  const campanha = applied.campanha || '';
  const organizacao = applied.organizacao || '';
  const cargo = applied.cargo || '';

  const fetchNPS = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/api/cs/nps`, {
        params: { campanha, organizacao, cargo },
        withCredentials: true,
      });
      if (res.data?.success) {
        setData(res.data.data);
        setFilters(res.data.filters || { campanhas: [], organizacoes: [], cargos: [] });
        setApplied(res.data.applied || { campanha, organizacao, cargo });
        setLastUpdated(new Date().toISOString());
      } else {
        setError(res.data?.error || 'Erro ao carregar NPS');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao carregar NPS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNPS();
  }, [campanha, organizacao, cargo]);

  const chartData = useMemo(() => {
    if (!data?.porNota?.length) return null;
    return {
      labels: data.porNota.map((x) => String(x.nota)),
      datasets: [
        {
          label: 'Respostas',
          data: data.porNota.map((x) => x.count),
          backgroundColor: 'rgba(255, 204, 0, 0.7)',
          borderColor: 'rgba(255, 204, 0, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [data?.porNota]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: false },
        tooltip: { callbacks: { label: (ctx) => `Nota ${ctx.label}: ${ctx.raw} resposta(s)` } },
      },
      scales: {
        x: { title: { display: true, text: 'Nota' } },
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    }),
    []
  );

  if (loading && !data) {
    return (
      <div className="cs-container">
        <div className="cs-skeleton">
          <div className="cs-skeleton-header" />
          <div className="cs-skeleton-filters" />
          <div className="cs-skeleton-metrics">
            <div className="cs-skeleton-gauge" />
            <div className="cs-skeleton-cards" />
          </div>
          <div className="cs-skeleton-chart" />
          <div className="cs-skeleton-tables" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="cs-container">
        <div className="cs-error">
          <p>{error}</p>
          <button type="button" className="cs-retry" onClick={fetchNPS}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const d = data || {};
  const nps = d.npsScore ?? 0;
  const totalRespostas = d.totalRespostas ?? 0;
  const metaRespostas = d.metaRespostas ?? 80;
  const respostasMetaPct = d.respostasMetaPct ?? 0;

  return (
    <div className="cs-container">
      <header className="cs-header">
        <div className="cs-header-text">
          <h1 className="cs-title">Relatório de NPS</h1>
          <p className="cs-subtitle">Dados do setor de sucesso do cliente</p>
        </div>
        {lastUpdated && (
          <p className="cs-last-update" aria-live="polite">
            Última atualização: {formatLastUpdate(lastUpdated)}
          </p>
        )}
      </header>

      <section className="cs-filters" aria-label="Filtros do relatório">
        <label className="cs-filter">
          <span className="cs-filter-label">Campanha</span>
          <select
            value={campanha}
            onChange={(e) => setApplied((a) => ({ ...a, campanha: e.target.value }))}
            className="cs-select"
            aria-label="Filtrar por campanha"
          >
            <option value="">Todos</option>
            {(filters.campanhas || []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="cs-filter">
          <span className="cs-filter-label">Organização</span>
          <select
            value={organizacao}
            onChange={(e) => setApplied((a) => ({ ...a, organizacao: e.target.value }))}
            className="cs-select"
            aria-label="Filtrar por organização"
          >
            <option value="">Todos</option>
            {(filters.organizacoes || []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="cs-filter">
          <span className="cs-filter-label">Cargo</span>
          <select
            value={cargo}
            onChange={(e) => setApplied((a) => ({ ...a, cargo: e.target.value }))}
            className="cs-select"
            aria-label="Filtrar por cargo"
          >
            <option value="">Todos</option>
            {(filters.cargos || []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="cs-refresh"
          onClick={fetchNPS}
          disabled={loading}
          aria-label={loading ? 'Atualizando dados' : 'Atualizar dados'}
        >
          {loading ? (
            <>
              <span className="cs-refresh-spinner" aria-hidden="true" />
              Atualizando…
            </>
          ) : (
            'Atualizar'
          )}
        </button>
      </section>

      <section className="cs-metrics" aria-label="Métricas NPS">
        <div className="cs-hero">
          <div className="cs-nps-gauge" role="img" aria-label={`NPS ${nps}`}>
            <span className="cs-nps-value">{nps}</span>
            <span className="cs-nps-unit">NPS</span>
            <div className="cs-nps-track">
              <div
                className="cs-nps-fill"
                style={{ width: `${((Math.min(100, Math.max(-100, nps)) + 100) / 200) * 100}%` }}
              />
            </div>
            <div className="cs-nps-scale">
              <span>-100</span>
              <span>0</span>
              <span>100</span>
            </div>
            <p className="cs-nps-formula">NPS = %Promotores − %Detratores</p>
          </div>
        </div>

        <div className="cs-cards-grid">
          <div className="cs-cards-group">
            <h3 className="cs-cards-group-title">Distribuição</h3>
            <div className="cs-cards cs-cards-nps">
              <div className="cs-card cs-card-promotores">
                <span className="cs-card-value">{d.promotores ?? 0}</span>
                <span className="cs-card-label">Promotores</span>
              </div>
              <div className="cs-card cs-card-neutros">
                <span className="cs-card-value">{d.neutros ?? 0}</span>
                <span className="cs-card-label">Neutros</span>
              </div>
              <div className="cs-card cs-card-detratores">
                <span className="cs-card-value">{d.detratores ?? 0}</span>
                <span className="cs-card-label">Detratores</span>
              </div>
            </div>
          </div>
          <div className="cs-cards-group">
            <h3 className="cs-cards-group-title">Respostas</h3>
            <div className="cs-cards cs-cards-meta">
              <div className="cs-card cs-card-meta">
                <span className="cs-card-value">{totalRespostas}</span>
                <span className="cs-card-label">Total de respostas</span>
              </div>
              <div className="cs-card cs-card-meta">
                <span className="cs-card-value">{metaRespostas}</span>
                <span className="cs-card-label">Meta de respostas</span>
              </div>
              <div className="cs-card cs-card-meta">
                <span className="cs-card-value">{respostasMetaPct}%</span>
                <span className="cs-card-label">Respostas / meta</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {chartData && (
        <section className="cs-chart-section" aria-labelledby="cs-chart-title">
          <h2 id="cs-chart-title" className="cs-section-title">Respostas por nota</h2>
          <div className="cs-chart-wrap">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </section>
      )}

      <section className="cs-tables" aria-label="Tabelas de detalhamento">
        <div className="cs-table-card">
          <h2 className="cs-section-title">Por organização</h2>
          <div className="cs-table-scroll">
            <table className="cs-table" aria-label="NPS por organização">
              <thead>
                <tr>
                  <th scope="col">Organização</th>
                  <th scope="col">Nº Respostas</th>
                </tr>
              </thead>
              <tbody>
                {(d.porOrganizacao || []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="cs-table-empty">
                      Nenhuma organização para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  (d.porOrganizacao || []).map((row, i) => (
                    <tr key={row.organizacao} className={i % 2 === 1 ? 'cs-table-zebra' : ''}>
                      <td>{row.organizacao}</td>
                      <td className="cs-table-num">{row.totalRespostas}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {d.porOrganizacao?.length > 0 && (
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td className="cs-table-num">{(d.porOrganizacao || []).reduce((s, r) => s + r.totalRespostas, 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="cs-table-card">
          <h2 className="cs-section-title">Por time</h2>
          <div className="cs-table-scroll">
            <table className="cs-table" aria-label="NPS por time">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Clientes ativos</th>
                  <th scope="col">Responderam</th>
                  <th scope="col">%</th>
                </tr>
              </thead>
              <tbody>
                {(d.porTime || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="cs-table-empty">
                      Nenhum time para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  (d.porTime || []).map((row, i) => (
                    <tr key={row.time} className={i % 2 === 1 ? 'cs-table-zebra' : ''}>
                      <td>{row.time}</td>
                      <td className="cs-table-num">{row.clientesAtivos}</td>
                      <td className="cs-table-num">{row.clientesResponderam}</td>
                      <td className="cs-table-num">{row.pctResponderam}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CSView;
