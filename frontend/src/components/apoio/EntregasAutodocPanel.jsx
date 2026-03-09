/**
 * Painel de Entregas Autodoc
 *
 * Exibe documentos entregues via Autodoc na ultima semana,
 * organizados por projeto/fase/disciplina, classificados como
 * novo_arquivo/nova_revisao/mudanca_fase.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { autodocEntregasApi } from '../../api/autodocEntregas';
import { useAuth } from '../../contexts/AuthContext';
import './EntregasAutodocPanel.css';

const CLASSIFICATION_CONFIG = {
  novo_arquivo: { label: 'Novo Arquivo', color: '#22c55e', bg: '#22c55e15' },
  nova_revisao: { label: 'Nova Revisao', color: '#3b82f6', bg: '#3b82f615' },
  mudanca_fase: { label: 'Mudanca de Fase', color: '#a855f7', bg: '#a855f715' },
};

const DAYS_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
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

function ClassificationBadge({ classification }) {
  const config = CLASSIFICATION_CONFIG[classification] || CLASSIFICATION_CONFIG.novo_arquivo;
  return (
    <span
      className="adoc-badge"
      style={{ backgroundColor: config.bg, color: config.color, borderColor: `${config.color}40` }}
    >
      {config.label}
    </span>
  );
}

function ChangeDescription({ doc }) {
  if (doc.classification === 'mudanca_fase' && doc.previous_phase && doc.phase_name) {
    return <span className="adoc-desc">{doc.previous_phase} → {doc.phase_name}</span>;
  }
  if (doc.classification === 'nova_revisao' && doc.previous_revision && doc.revision) {
    return <span className="adoc-desc">{doc.previous_revision} → {doc.revision}</span>;
  }
  return null;
}

function SummaryCards({ summary, loading }) {
  if (loading || !summary) {
    return (
      <div className="adoc-summary">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="adoc-stat-card adoc-stat--loading">
            <div className="adoc-stat-value">—</div>
            <div className="adoc-stat-label">Carregando...</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="adoc-summary">
      <div className="adoc-stat-card">
        <div className="adoc-stat-value">{summary.totalEntregas}</div>
        <div className="adoc-stat-label">Entregas</div>
      </div>
      <div className="adoc-stat-card adoc-stat--green">
        <div className="adoc-stat-value">{summary.porClassificacao?.novo_arquivo || 0}</div>
        <div className="adoc-stat-label">Novos Arq.</div>
      </div>
      <div className="adoc-stat-card adoc-stat--blue">
        <div className="adoc-stat-value">{summary.porClassificacao?.nova_revisao || 0}</div>
        <div className="adoc-stat-label">Revisoes</div>
      </div>
      <div className="adoc-stat-card adoc-stat--purple">
        <div className="adoc-stat-value">{summary.porClassificacao?.mudanca_fase || 0}</div>
        <div className="adoc-stat-label">Mud. Fase</div>
      </div>
    </div>
  );
}

export default function EntregasAutodocPanel() {
  const { isPrivileged } = useAuth();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(7);
  const [classificationFilter, setClassificationFilter] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const limit = 50;

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit, days };
      if (classificationFilter) params.classification = classificationFilter;
      const res = await autodocEntregasApi.getRecentEntregas(params);
      if (res.data?.success) {
        setDocs(res.data.data || []);
        setTotal(res.data.total || 0);
      } else {
        setError(res.data?.error || 'Erro ao carregar entregas');
      }
    } catch (err) {
      console.error('Erro ao buscar entregas Autodoc:', err);
      setError(err.response?.data?.error || 'Erro ao carregar entregas');
    } finally {
      setLoading(false);
    }
  }, [page, days, classificationFilter]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await autodocEntregasApi.getSummary({ days });
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
    fetchDocs();
    fetchSummary();
  }, [fetchDocs, fetchSummary]);

  const handleSyncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await autodocEntregasApi.syncAll();
      if (res.data?.success) {
        setSyncResult(res.data.data);
        fetchDocs();
        fetchSummary();
      }
    } catch (err) {
      console.error('Erro no sync:', err);
      setSyncResult({ error: err.response?.data?.error || err.message });
    } finally {
      setSyncing(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="adoc-container">
      {/* Header */}
      <div className="adoc-header">
        <h2 className="adoc-title">Entregas Autodoc</h2>
        <div className="adoc-header-actions">
          {isPrivileged && (
            <button
              className="adoc-sync-btn"
              onClick={handleSyncAll}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <span className="adoc-spinner" />
                  Sincronizando...
                </>
              ) : (
                'Sincronizar Agora'
              )}
            </button>
          )}
          <button className="adoc-refresh-btn" onClick={() => { fetchDocs(); fetchSummary(); }} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sync result toast */}
      {syncResult && !syncResult.error && (
        <div className="adoc-toast adoc-toast--success">
          Sync concluido: {syncResult.totalCustomers} contas, {syncResult.totalDocuments} documentos, {syncResult.newDocuments} novos
          <button className="adoc-toast-close" onClick={() => setSyncResult(null)}>&times;</button>
        </div>
      )}
      {syncResult?.error && (
        <div className="adoc-toast adoc-toast--error">
          Erro no sync: {syncResult.error}
          <button className="adoc-toast-close" onClick={() => setSyncResult(null)}>&times;</button>
        </div>
      )}

      {/* Summary Cards */}
      <SummaryCards summary={summary} loading={summaryLoading} />

      {/* Filters */}
      <div className="adoc-filters">
        <div className="adoc-filter-group">
          <label>Periodo:</label>
          <select
            value={days}
            onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}
            className="adoc-select"
          >
            {DAYS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="adoc-filter-group">
          <label>Classificacao:</label>
          <select
            value={classificationFilter}
            onChange={(e) => { setClassificationFilter(e.target.value); setPage(1); }}
            className="adoc-select"
          >
            <option value="">Todas</option>
            {Object.entries(CLASSIFICATION_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
        <div className="adoc-filter-count">
          <strong>{total}</strong> entrega{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="adoc-loading">
          <div className="adoc-spinner-lg" />
          <p>Carregando entregas...</p>
        </div>
      ) : error ? (
        <div className="adoc-error">
          <p>{error}</p>
          <button onClick={fetchDocs} className="adoc-refresh-btn">Tentar novamente</button>
        </div>
      ) : docs.length === 0 ? (
        <div className="adoc-empty">
          <p className="adoc-empty-title">Nenhuma entrega encontrada</p>
          <p className="adoc-empty-hint">
            {total === 0
              ? 'Configure mapeamentos e sincronize para ver entregas'
              : 'Tente ajustar os filtros'
            }
          </p>
        </div>
      ) : (
        <>
          <div className="adoc-table-wrapper">
            <table className="adoc-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Projeto</th>
                  <th>Documento</th>
                  <th style={{ width: 100 }}>Codigo</th>
                  <th style={{ width: 50 }}>Rev</th>
                  <th style={{ width: 80 }}>Fase</th>
                  <th style={{ width: 100 }}>Disciplina</th>
                  <th style={{ width: 60 }}>Formato</th>
                  <th style={{ width: 130 }}>Classificacao</th>
                  <th style={{ width: 120 }}>Detalhe</th>
                  <th style={{ width: 130 }}>Data</th>
                  <th style={{ width: 70 }}>Tam</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id || doc.autodoc_doc_id}>
                    <td className="adoc-project-code">{doc.project_code}</td>
                    <td className="adoc-doc-name" title={doc.document_name}>{doc.document_name}</td>
                    <td className="adoc-doc-code">{doc.document_code || '-'}</td>
                    <td>{doc.revision || '-'}</td>
                    <td>{doc.phase_name || '-'}</td>
                    <td>{doc.discipline_name || '-'}</td>
                    <td>{doc.format_folder || '-'}</td>
                    <td><ClassificationBadge classification={doc.classification} /></td>
                    <td><ChangeDescription doc={doc} /></td>
                    <td className="adoc-date">{formatDate(doc.autodoc_created_at)}</td>
                    <td className="adoc-file-size">{formatFileSize(doc.raw_size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="adoc-pagination">
              <button
                className="adoc-page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </button>
              <span className="adoc-page-info">
                Pagina {page} de {totalPages}
              </span>
              <button
                className="adoc-page-btn"
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
