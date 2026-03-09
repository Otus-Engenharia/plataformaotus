import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ParcelaChangeLog.css';

const ACTION_LABELS = {
  criar: 'Criou',
  editar: 'Editou',
  vincular: 'Vinculou',
  smartsheet_change: 'Cronograma alterado',
  status_change: 'Status alterado',
};

const FIELD_LABELS = {
  status_projetos: 'Status Projetos',
  status_financeiro: 'Status Financeiro',
  status: 'Status',
  data_termino: 'Data Termino',
};

export default function ParcelaChangeLog({ projectCode }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectCode) return;
    setLoading(true);
    axios.get(`/api/pagamentos/change-log?projectCode=${projectCode}`)
      .then(({ data }) => {
        if (data.success) setEntries(data.data);
      })
      .catch(err => console.error('Erro ao buscar change log:', err))
      .finally(() => setLoading(false));
  }, [projectCode]);

  if (loading) return <div className="change-log-loading">Carregando historico...</div>;
  if (entries.length === 0) return <div className="change-log-empty">Nenhuma alteracao registrada</div>;

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="change-log-timeline">
      {entries.map(entry => (
        <div key={entry.id} className="change-log-entry">
          <div className="change-log-dot" />
          <div className="change-log-content">
            <div className="change-log-header">
              <span className="change-log-action">{ACTION_LABELS[entry.action] || entry.action}</span>
              <span className="change-log-time">{formatDate(entry.created_at)}</span>
            </div>
            {entry.field_changed && (
              <div className="change-log-detail">
                <span className="change-log-field">{FIELD_LABELS[entry.field_changed] || entry.field_changed}:</span>
                {entry.old_value && <span className="change-log-old">{entry.old_value}</span>}
                {entry.old_value && entry.new_value && <span className="change-log-arrow">&rarr;</span>}
                {entry.new_value && <span className="change-log-new">{entry.new_value}</span>}
              </div>
            )}
            <div className="change-log-author">{entry.edited_by_name || entry.edited_by_email}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
