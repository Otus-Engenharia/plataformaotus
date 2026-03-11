import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import './SpotsHistoricoView.css';

const ACTION_LABELS = {
  criar: 'Criou',
  editar: 'Editou',
  vincular: 'Vinculou',
  smartsheet_change: 'Cronograma alterado',
  status_change: 'Status alterado',
};

const ACTION_COLORS = {
  criar: '#22c55e',
  editar: '#3b82f6',
  vincular: '#8b5cf6',
  smartsheet_change: '#f59e0b',
  status_change: '#06b6d4',
};

const FIELD_LABELS = {
  status_projetos: 'Status Projetos',
  status_financeiro: 'Status Financeiro',
  status: 'Status',
  data_termino: 'Data Termino',
  descricao: 'Descricao',
  valor: 'Valor',
  dilatacao_dias: 'Dilatacao',
  smartsheet_task_name: 'Tarefa Vinculada',
  smartsheet_data_termino: 'Data Termino Cronograma',
};

const DATE_FIELDS = new Set(['data_termino', 'smartsheet_data_termino']);
const CURRENCY_FIELDS = new Set(['valor']);

function formatChangeValue(field, value) {
  if (value == null || value === '') return null;
  const str = String(value);
  if (DATE_FIELDS.has(field)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    }
  }
  if (CURRENCY_FIELDS.has(field)) {
    const num = parseFloat(str);
    if (!isNaN(num)) {
      return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
  }
  return str;
}

function groupBySyncBatch(entries) {
  const result = [];
  const used = new Set();
  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue;
    const entry = entries[i];
    const ts = new Date(entry.created_at).getTime();
    const batch = [entry];
    used.add(i);
    for (let j = i + 1; j < entries.length; j++) {
      if (used.has(j)) continue;
      const other = entries[j];
      if (
        other.parcela_id === entry.parcela_id &&
        Math.abs(new Date(other.created_at).getTime() - ts) <= 2000
      ) {
        batch.push(other);
        used.add(j);
      }
    }
    if (batch.length > 1) {
      result.push({ ...entry, _batchEntries: batch });
    } else {
      result.push(entry);
    }
  }
  return result;
}

const ACTION_FILTER_OPTIONS = [
  { key: 'todos', label: 'Todos' },
  { key: 'editar', label: 'Edicoes' },
  { key: 'status_change', label: 'Status' },
  { key: 'vincular', label: 'Vinculacoes' },
  { key: 'smartsheet_change', label: 'Cronograma' },
  { key: 'criar', label: 'Criacao' },
];

function groupByDate(entries) {
  const groups = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const toDateKey = (d) => {
    const date = new Date(d);
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();
    const dateStr = date.toDateString();
    if (dateStr === todayStr) return 'Hoje';
    if (dateStr === yesterdayStr) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  };

  for (const entry of entries) {
    const key = toDateKey(entry.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
}

export default function SpotsHistoricoView() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterAction, setFilterAction] = useState('todos');
  const [lastSeen] = useState(() => {
    if (!user?.id) return null;
    return localStorage.getItem(`spots_last_seen_${user.id}`) || null;
  });

  const LIMIT = 50;

  const fetchEntries = useCallback(async (offset = 0, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
        excludeEmail: user?.email || '',
      });

      const { data } = await axios.get(`/api/pagamentos/global-change-log?${params}`);
      if (data.success) {
        const newEntries = data.data.entries || [];
        setEntries(prev => append ? [...prev, ...newEntries] : newEntries);
        setTotal(data.data.total || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar historico global:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.email]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleLoadMore = () => {
    fetchEntries(entries.length, true);
  };

  const filteredEntries = filterAction === 'todos'
    ? entries
    : entries.filter(e => e.action === filterAction);

  const batchedEntries = groupBySyncBatch(filteredEntries).filter(entry => {
    if (entry.action !== 'smartsheet_change') return true;
    // For smartsheet_change, keep only if at least 1 detail has valid old_value
    const details = entry._batchEntries || (entry.field_changed ? [entry] : []);
    return details.some(de => {
      const raw = de.old_value;
      return raw != null && raw !== '' && raw !== '[object Object]';
    });
  });
  const grouped = groupByDate(batchedEntries);

  const formatTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const isNew = (entry) => {
    if (!lastSeen) return false;
    return new Date(entry.created_at) > new Date(lastSeen);
  };

  const getParcelaDesc = (entry) => {
    const parcela = entry.parcelas_pagamento;
    if (parcela) return parcela.descricao || `Parcela`;
    return 'Parcela';
  };

  const getProjectInfo = (entry) => {
    const parcela = entry.parcelas_pagamento;
    const code = parcela?.project_code || entry.project_code;
    return { code, name: entry.project_name || '' };
  };

  const sanitizeValue = (v) => (!v || v === '[object Object]') ? null : v;

  if (loading) {
    return (
      <div className="spots-hist-container">
        <div className="spots-hist-loading">Carregando historico...</div>
      </div>
    );
  }

  return (
    <div className="spots-hist-container">
      <div className="spots-hist-header">
        <h2>Historico de Alteracoes SPOTs</h2>
        <span className="spots-hist-count">{total} alteracao{total !== 1 ? 'es' : ''}</span>
      </div>

      {/* Filters */}
      <div className="spots-hist-filters">
        {ACTION_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`spots-hist-filter-btn ${filterAction === opt.key ? 'active' : ''}`}
            onClick={() => setFilterAction(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filteredEntries.length === 0 ? (
        <div className="spots-hist-empty">
          <p>Nenhuma alteracao encontrada</p>
        </div>
      ) : (
        <div className="spots-hist-timeline">
          {Object.entries(grouped).map(([dateLabel, dateEntries]) => (
            <div key={dateLabel} className="spots-hist-date-group">
              <div className="spots-hist-date-label">{dateLabel}</div>
              <div className="spots-hist-entries">
                {dateEntries.map(entry => {
                  const project = getProjectInfo(entry);
                  const entryIsNew = isNew(entry);
                  return (
                    <div key={entry.id} className={`spots-hist-entry ${entryIsNew ? 'spots-hist-entry-new' : ''}`}>
                      <div
                        className="spots-hist-dot"
                        style={{ background: ACTION_COLORS[entry.action] || '#6b7280' }}
                      />
                      <div className="spots-hist-entry-content">
                        <div className="spots-hist-entry-header">
                          <span
                            className="spots-hist-action-badge"
                            style={{ background: ACTION_COLORS[entry.action] || '#6b7280' }}
                          >
                            {ACTION_LABELS[entry.action] || entry.action}
                          </span>
                          <span className="spots-hist-parcela-desc">
                            {getParcelaDesc(entry)}
                          </span>
                          {project.code && (
                            <span className="spots-hist-project">
                              {project.code}
                              {project.name && <span className="spots-hist-project-name"> {project.name}</span>}
                            </span>
                          )}
                          {entryIsNew && <span className="spots-hist-new-badge">Novo</span>}
                        </div>
                        {(() => {
                          const detailEntries = entry._batchEntries || (entry.field_changed ? [entry] : []);
                          if (detailEntries.length === 0) return null;
                          return (
                            <div className={detailEntries.length > 1 ? 'spots-hist-detail-group' : ''}>
                              {detailEntries.map((de, idx) => {
                                const rawOld = sanitizeValue(de.old_value);
                                const rawNew = sanitizeValue(de.new_value);
                                const field = de.field_changed;
                                if (!field) return null;
                                const fieldLabel = FIELD_LABELS[field] || field;
                                const oldFormatted = formatChangeValue(field, rawOld);
                                const newFormatted = formatChangeValue(field, rawNew);
                                // Skip entries where old and new are identical (no real change)
                                if (oldFormatted && newFormatted && oldFormatted === newFormatted) return null;
                                // Skip corrupted smartsheet_change entries without old_value (incomplete data)
                                if ((de.action === 'smartsheet_change' || entry.action === 'smartsheet_change') && !oldFormatted) return null;
                                if (!oldFormatted && !newFormatted) {
                                  return (
                                    <div key={idx} className="spots-hist-detail">
                                      <span className="spots-hist-field">{fieldLabel}</span>
                                      <span className="spots-hist-muted"> alterado(a)</span>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={idx} className="spots-hist-detail">
                                    <span className="spots-hist-field">{fieldLabel}:</span>
                                    {oldFormatted && <span className="spots-hist-old">{oldFormatted}</span>}
                                    {oldFormatted && newFormatted && <span className="spots-hist-arrow">&rarr;</span>}
                                    {!oldFormatted && newFormatted && <span className="spots-hist-arrow">&rarr;</span>}
                                    {newFormatted && <span className="spots-hist-new">{newFormatted}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        <div className="spots-hist-meta">
                          <span className={`spots-hist-author ${entry.action === 'smartsheet_change' ? 'spots-hist-author-auto' : ''}`}>
                            {entry.action === 'smartsheet_change' ? 'Smartsheet Sync' : (entry.edited_by_name || entry.edited_by_email)}
                          </span>
                          <span className="spots-hist-time">{formatTime(entry.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {entries.length < total && (
            <div className="spots-hist-load-more">
              <button
                className="spots-hist-load-more-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Carregando...' : `Carregar mais (${entries.length}/${total})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
