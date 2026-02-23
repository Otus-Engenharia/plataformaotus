/**
 * Componente: Tabela de Baselines
 * Exibe a lista de baselines com ações de edição e exclusão.
 */

import React, { useState } from 'react';

function BaselineTable({ baselines, selectedId, onSelect, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const startEdit = (e, baseline) => {
    e.stopPropagation();
    setEditingId(baseline.id);
    setEditName(baseline.name);
    setEditDesc(baseline.description || '');
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const saveEdit = async (e) => {
    e.stopPropagation();
    await onUpdate(editingId, { name: editName, description: editDesc });
    setEditingId(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  return (
    <div className="baselines-table-wrapper">
      <table className="baselines-table">
        <thead>
          <tr>
            <th className="col-rev">Rev.</th>
            <th className="col-name">Nome</th>
            <th className="col-date">Data Snapshot</th>
            <th className="col-tasks">Tarefas</th>
            <th className="col-source">Fonte</th>
            <th className="col-status">Status</th>
            <th className="col-actions">Ações</th>
          </tr>
        </thead>
        <tbody>
          {baselines.map(bl => (
            <tr
              key={bl.id}
              className={`baselines-row ${selectedId === bl.id ? 'selected' : ''} ${!bl.is_active ? 'inactive' : ''}`}
              onClick={() => onSelect(selectedId === bl.id ? null : bl)}
            >
              <td className="col-rev">
                <span className="revision-badge">{bl.revision_label}</span>
              </td>
              <td className="col-name">
                {editingId === bl.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="baselines-edit-input"
                    autoFocus
                  />
                ) : (
                  <span className="baseline-name">{bl.name}</span>
                )}
                {bl.description && editingId !== bl.id && (
                  <span className="baseline-desc-preview" title={bl.description}>
                    {bl.description.length > 60
                      ? bl.description.substring(0, 60) + '...'
                      : bl.description}
                  </span>
                )}
                {editingId === bl.id && (
                  <input
                    type="text"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="baselines-edit-input baselines-edit-desc"
                    placeholder="Motivo/descrição..."
                  />
                )}
              </td>
              <td className="col-date">{formatDate(bl.snapshot_date)}</td>
              <td className="col-tasks">{bl.task_count || 0}</td>
              <td className="col-source">
                <span className={`source-badge source-${bl.source}`}>
                  {bl.source === 'smartsheet' ? 'SmartSheet' : 'Plataforma'}
                </span>
              </td>
              <td className="col-status">
                <span className={`status-dot ${bl.is_active ? 'active' : 'inactive'}`} />
                {bl.is_active ? 'Ativa' : 'Inativa'}
              </td>
              <td className="col-actions">
                {editingId === bl.id ? (
                  <>
                    <button className="btn-action btn-save" onClick={saveEdit} title="Salvar">&#10003;</button>
                    <button className="btn-action btn-cancel" onClick={cancelEdit} title="Cancelar">&#10005;</button>
                  </>
                ) : (
                  <>
                    <button className="btn-action btn-edit" onClick={(e) => startEdit(e, bl)} title="Editar">&#9998;</button>
                    <button className="btn-action btn-delete" onClick={(e) => { e.stopPropagation(); onDelete(bl.id); }} title="Excluir">&#128465;</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BaselineTable;
