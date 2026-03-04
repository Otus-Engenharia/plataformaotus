/**
 * Painel de IFC Change Log
 *
 * Exibe mudanças recentes detectadas nas pastas IFC do Google Drive,
 * com filtros por projeto, categoria e período, indicadores de resumo
 * e validação automática de nomenclatura.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ifcChangelogApi } from '../../api/ifcChangelog';
import { useAuth } from '../../contexts/AuthContext';
import './IfcChangeLogPanel.css';

const CATEGORY_CONFIG = {
  nova_revisao: { label: 'Nova Revisao', color: '#22c55e', bg: '#22c55e15' },
  mudanca_fase: { label: 'Mudanca de Fase', color: '#3b82f6', bg: '#3b82f615' },
  novo_arquivo: { label: 'Novo Arquivo', color: '#a855f7', bg: '#a855f715' },
};

const DAYS_OPTIONS = [
  { value: 1, label: '1 dia' },
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
];

function formatFileSize(bytes) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = Number(bytes);
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function CategoryBadge({ category }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.novo_arquivo;
  return (
    <span
      className="ifc-cl-badge"
      style={{ backgroundColor: config.bg, color: config.color, borderColor: `${config.color}40` }}
    >
      {config.label}
    </span>
  );
}

function NomenclaturaBadge({ conforme, erros }) {
  if (conforme === null || conforme === undefined) {
    return <span className="ifc-cl-nom-badge ifc-cl-nom--na" title="Sem padrao configurado">—</span>;
  }
  if (conforme) {
    return <span className="ifc-cl-nom-badge ifc-cl-nom--ok" title="Conforme">OK</span>;
  }
  return (
    <span
      className="ifc-cl-nom-badge ifc-cl-nom--error"
      title={erros?.length ? erros.join('\n') : 'Nao conforme'}
    >
      NC
    </span>
  );
}

function ChangeDescription({ log }) {
  if (log.category === 'mudanca_fase' && log.previous_phase && log.new_phase) {
    return <span className="ifc-cl-desc">{log.previous_phase} → {log.new_phase}</span>;
  }
  if (log.category === 'nova_revisao' && log.previous_revision && log.new_revision) {
    return <span className="ifc-cl-desc">{log.previous_revision} → {log.new_revision}</span>;
  }
  return null;
}

function SummaryCards({ summary, loading }) {
  if (loading || !summary) {
    return (
      <div className="ifc-cl-summary">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="ifc-cl-stat-card ifc-cl-stat--loading">
            <div className="ifc-cl-stat-value">—</div>
            <div className="ifc-cl-stat-label">Carregando...</div>
          </div>
        ))}
      </div>
    );
  }

  const nomTotal = summary.nomenclatura.conformes + summary.nomenclatura.naoConformes;
  const nomPct = nomTotal > 0 ? Math.round((summary.nomenclatura.conformes / nomTotal) * 100) : null;

  return (
    <div className="ifc-cl-summary">
      <div className="ifc-cl-stat-card">
        <div className="ifc-cl-stat-value">{summary.totalMudancas}</div>
        <div className="ifc-cl-stat-label">Mudancas</div>
      </div>
      <div className="ifc-cl-stat-card ifc-cl-stat--green">
        <div className="ifc-cl-stat-value">{summary.porCategoria.nova_revisao}</div>
        <div className="ifc-cl-stat-label">Revisoes</div>
      </div>
      <div className="ifc-cl-stat-card ifc-cl-stat--blue">
        <div className="ifc-cl-stat-value">{summary.porCategoria.mudanca_fase}</div>
        <div className="ifc-cl-stat-label">Mud. Fase</div>
      </div>
      <div className="ifc-cl-stat-card ifc-cl-stat--purple">
        <div className="ifc-cl-stat-value">{summary.porCategoria.novo_arquivo}</div>
        <div className="ifc-cl-stat-label">Novos Arq.</div>
      </div>
      <div className="ifc-cl-stat-card">
        <div className="ifc-cl-stat-value">{summary.projetosAtivos}</div>
        <div className="ifc-cl-stat-label">Projetos</div>
      </div>
      <div className="ifc-cl-stat-card">
        <div className="ifc-cl-stat-value">{formatFileSize(summary.tamanhoTotal)}</div>
        <div className="ifc-cl-stat-label">Vol. Total</div>
      </div>
      {nomTotal > 0 && (
        <div className={`ifc-cl-stat-card ${nomPct >= 80 ? 'ifc-cl-stat--green' : nomPct >= 50 ? 'ifc-cl-stat--yellow' : 'ifc-cl-stat--red'}`}>
          <div className="ifc-cl-stat-value">{nomPct}%</div>
          <div className="ifc-cl-stat-label">Nomenclatura</div>
          <div className="ifc-cl-stat-sub">{summary.nomenclatura.conformes}/{nomTotal}</div>
        </div>
      )}
    </div>
  );
}

export default function IfcChangeLogPanel() {
  const { isPrivileged } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const limit = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ifcChangelogApi.getRecentChanges({ page, limit, days });
      if (res.data?.success) {
        setLogs(res.data.data || []);
        setTotal(res.data.total || 0);
      } else {
        setError(res.data?.error || 'Erro ao carregar logs');
      }
    } catch (err) {
      console.error('Erro ao buscar IFC changelog:', err);
      setError(err.response?.data?.error || 'Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, [page, days]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await ifcChangelogApi.getSummary({ days });
      if (res.data?.success) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar resumo:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchLogs();
    fetchSummary();
  }, [fetchLogs, fetchSummary]);

  const handleScanAll = async () => {
    if (scanning) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await ifcChangelogApi.scanAll();
      if (res.data?.success) {
        setScanResult(res.data.data);
        fetchLogs();
        fetchSummary();
      }
    } catch (err) {
      console.error('Erro no scan:', err);
      setScanResult({ error: err.response?.data?.error || err.message });
    } finally {
      setScanning(false);
    }
  };

  const filteredLogs = categoryFilter
    ? logs.filter(l => l.category === categoryFilter)
    : logs;

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="ifc-cl-container">
      {/* Header */}
      <div className="ifc-cl-header">
        <h2 className="ifc-cl-title">IFC Changelog</h2>
        <div className="ifc-cl-header-actions">
          {isPrivileged && (
            <button
              className="ifc-cl-scan-btn"
              onClick={handleScanAll}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <span className="ifc-cl-spinner" />
                  Escaneando...
                </>
              ) : (
                'Escanear Todos'
              )}
            </button>
          )}
          <button className="ifc-cl-refresh-btn" onClick={() => { fetchLogs(); fetchSummary(); }} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scan result toast */}
      {scanResult && !scanResult.error && (
        <div className="ifc-cl-toast ifc-cl-toast--success">
          Scan concluido: {scanResult.totalProjects} projetos escaneados, {scanResult.totalChanges} mudancas detectadas
          <button className="ifc-cl-toast-close" onClick={() => setScanResult(null)}>&times;</button>
        </div>
      )}
      {scanResult?.error && (
        <div className="ifc-cl-toast ifc-cl-toast--error">
          Erro no scan: {scanResult.error}
          <button className="ifc-cl-toast-close" onClick={() => setScanResult(null)}>&times;</button>
        </div>
      )}

      {/* Summary Cards */}
      <SummaryCards summary={summary} loading={summaryLoading} />

      {/* Filters */}
      <div className="ifc-cl-filters">
        <div className="ifc-cl-filter-group">
          <label>Periodo:</label>
          <select
            value={days}
            onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}
            className="ifc-cl-select"
          >
            {DAYS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="ifc-cl-filter-group">
          <label>Categoria:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="ifc-cl-select"
          >
            <option value="">Todas</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
        <div className="ifc-cl-filter-count">
          <strong>{categoryFilter ? filteredLogs.length : total}</strong> mudanca{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="ifc-cl-loading">
          <div className="ifc-cl-spinner-lg" />
          <p>Carregando changelog...</p>
        </div>
      ) : error ? (
        <div className="ifc-cl-error">
          <p>{error}</p>
          <button onClick={fetchLogs} className="ifc-cl-refresh-btn">Tentar novamente</button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="ifc-cl-empty">
          <p className="ifc-cl-empty-title">Nenhuma mudanca encontrada</p>
          <p className="ifc-cl-empty-hint">
            {total === 0
              ? 'Execute um scan para detectar mudancas nas pastas IFC'
              : 'Tente ajustar os filtros'
            }
          </p>
        </div>
      ) : (
        <>
          <div className="ifc-cl-table-wrapper">
            <table className="ifc-cl-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Projeto</th>
                  <th style={{ width: 130 }}>Categoria</th>
                  <th>Arquivo</th>
                  <th style={{ width: 50 }}>Nom.</th>
                  <th style={{ width: 120 }}>Detalhe</th>
                  <th style={{ width: 80 }}>Tamanho</th>
                  <th style={{ width: 130 }}>Detectado em</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="ifc-cl-project-code">{log.project_code}</td>
                    <td><CategoryBadge category={log.category} /></td>
                    <td className="ifc-cl-file-name" title={log.file_name}>{log.file_name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <NomenclaturaBadge conforme={log.nomenclatura_conforme} erros={log.nomenclatura_erros} />
                    </td>
                    <td><ChangeDescription log={log} /></td>
                    <td className="ifc-cl-file-size">{formatFileSize(log.file_size)}</td>
                    <td className="ifc-cl-date">{formatDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ifc-cl-pagination">
              <button
                className="ifc-cl-page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </button>
              <span className="ifc-cl-page-info">
                Pagina {page} de {totalPages}
              </span>
              <button
                className="ifc-cl-page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Proxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
